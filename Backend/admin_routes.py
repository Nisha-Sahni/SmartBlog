
"""
SmartBlog — Admin Panel Backend
Dedicated admin endpoints for platform monitoring, blog management,
user management, community moderation, and support ticket management.

LOCAL EXPO DEMO:
Set SMARTBLOG_ADMIN_DEMO_MODE=1 to bypass the admin login token locally.
The demo bypass only works when both the request host and client address
are localhost/loopback. Do not enable it on a public server.
"""

import os
import re
import ipaddress
from functools import wraps

from flask import Blueprint, request, jsonify, current_app
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired
from werkzeug.security import check_password_hash
import mysql.connector

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


# =========================================================
# DATABASE AND COMMON HELPERS
# =========================================================

def get_db():
    # Set SMARTBLOG_DB_PASSWORD in your environment.
    db_password = os.getenv("SMARTBLOG_DB_PASSWORD", "nishasahni@2626")

    return mysql.connector.connect(
        host=os.getenv("SMARTBLOG_DB_HOST", "localhost"),
        user=os.getenv("SMARTBLOG_DB_USER", "root"),
        password=db_password,
        database=os.getenv("SMARTBLOG_DB_NAME", "smartblog")
    )


def get_serializer():
    secret_key = os.getenv(
        "SMARTBLOG_SECRET_KEY",
        "smartblog-dev-secret-key-2026"
    )
    return URLSafeTimedSerializer(secret_key, salt="smartblog-login")


def clean_text(value):
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def is_local_demo_mode():
    """
    Allow the login bypass only when:
    1. SMARTBLOG_ADMIN_DEMO_MODE is explicitly enabled.
    2. The client address is a loopback address.
    3. The request host is localhost or a loopback host.
    """

    enabled = os.getenv("SMARTBLOG_ADMIN_DEMO_MODE", "0") == "1"

    if not enabled:
        return False

    remote_addr = request.remote_addr or ""

    try:
        is_loopback = ipaddress.ip_address(remote_addr).is_loopback
    except ValueError:
        is_loopback = False

    host = (request.host or "").lower().strip()

    # Accept localhost and IPv4/IPv6 loopback hosts, with or without a port.
    local_hosts = {
        "localhost",
        "localhost:5000",
        "127.0.0.1",
        "127.0.0.1:5000",
        "[::1]",
        "[::1]:5000"
    }

    return is_loopback and host in local_hosts


def get_local_demo_admin():
    """
    Find a real active administrator in MySQL for the local demo.
    This preserves request.admin_user for routes that use it.
    """

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT user_id, name, email, is_admin, status
            FROM users
            WHERE is_admin = 1
              AND (status = 'active' OR status IS NULL)
            ORDER BY user_id ASC
            LIMIT 1
        """)

        return cur.fetchone()

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


# =========================================================
# ADMIN AUTHORIZATION
# =========================================================

def require_admin(f):
    @wraps(f)
    def decorated(*args, **kwargs):

        # LOCAL EXPO DEMO MODE — no login token required.
        # Still uses a real active admin record from MySQL.
        if is_local_demo_mode():
            try:
                admin = get_local_demo_admin()

                if not admin:
                    return jsonify({
                        "success": False,
                        "message": (
                            "No active administrator account exists in MySQL. "
                            "Create an admin account before using demo mode."
                        )
                    }), 403

                request.admin_user = admin

            except Exception:
                current_app.logger.exception(
                    "Could not load local demo administrator"
                )
                return jsonify({
                    "success": False,
                    "message": "Could not verify the demo administrator."
                }), 500

            return f(*args, **kwargs)

        # NORMAL ADMIN AUTHENTICATION.
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "success": False,
                "message": "Admin authorization token required."
            }), 401

        token = auth_header.split(" ", 1)[1].strip()
        serializer = get_serializer()

        try:
            payload = serializer.loads(
                token,
                max_age=60 * 60 * 24 * 7
            )
            user_id = int(payload["user_id"])

        except (BadSignature, SignatureExpired, Exception):
            return jsonify({
                "success": False,
                "message": (
                    "Invalid or expired admin session. "
                    "Please log in again."
                )
            }), 401

        cnx = None
        cur = None

        try:
            cnx = get_db()
            cur = cnx.cursor(dictionary=True)

            cur.execute("""
                SELECT user_id, name, email, is_admin, status
                FROM users
                WHERE user_id = %s
            """, (user_id,))

            user = cur.fetchone()

            if not user or not user.get("is_admin"):
                return jsonify({
                    "success": False,
                    "message": (
                        "Access denied. Administrator privileges required."
                    )
                }), 403

            if user.get("status") and user.get("status") != "active":
                return jsonify({
                    "success": False,
                    "message": "Your admin account is currently suspended."
                }), 403

            request.admin_user = user

        finally:
            if cur:
                cur.close()

            if cnx and cnx.is_connected():
                cnx.close()

        return f(*args, **kwargs)

    return decorated


# =========================================================
# 1. ADMIN AUTHENTICATION
# =========================================================

@admin_bp.route("/login", methods=["POST"])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = clean_text(data.get("email")).lower()
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({
            "success": False,
            "message": "Admin email and password are required."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT user_id, name, email, password, is_admin, status,
                   reputation_points
            FROM users
            WHERE email = %s
        """, (email,))

        user = cur.fetchone()

        if not user or not check_password_hash(user["password"], password):
            return jsonify({
                "success": False,
                "message": "Invalid credentials."
            }), 401

        if not user.get("is_admin"):
            return jsonify({
                "success": False,
                "message": (
                    "Access denied. You do not have administrator permissions."
                )
            }), 403

        if user.get("status") and user.get("status") != "active":
            return jsonify({
                "success": False,
                "message": "Account suspended. Contact system administrator."
            }), 403

        token = get_serializer().dumps({
            "user_id": user["user_id"]
        })

        return jsonify({
            "success": True,
            "message": "Admin authentication successful.",
            "token": token,
            "user": {
                "user_id": user["user_id"],
                "name": user["name"],
                "email": user["email"],
                "is_admin": bool(user["is_admin"]),
                "status": user["status"]
            }
        }), 200

    except Exception:
        current_app.logger.exception("Admin login error")
        return jsonify({
            "success": False,
            "message": "Server error during admin login."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/setup-first-admin", methods=["POST"])
def setup_first_admin():
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        # Check if an admin already exists in MySQL.
        cur.execute("""
            SELECT COUNT(*) AS admin_count
            FROM users
            WHERE is_admin = 1
        """)

        row = cur.fetchone()
        admin_count = row["admin_count"] if row else 0

        if admin_count > 0:
            return jsonify({
                "success": False,
                "message": (
                    "First administrator account has already been "
                    "initialized. Setup is locked."
                )
            }), 403

        data = request.get_json(silent=True) or {}

        name = clean_text(data.get("name"))
        email = clean_text(data.get("email")).lower()
        password = data.get("password") or ""

        if not name or not email or not password:
            return jsonify({
                "success": False,
                "message": "Name, email, and password are required."
            }), 400

        if len(password) < 8:
            return jsonify({
                "success": False,
                "message": "Password must be at least 8 characters long."
            }), 400

        from werkzeug.security import generate_password_hash

        hashed_password = generate_password_hash(password)

        cur.execute("""
            SELECT user_id
            FROM users
            WHERE email = %s
        """, (email,))

        existing = cur.fetchone()

        if existing:
            cur.execute("""
                UPDATE users
                SET name = %s,
                    password = %s,
                    is_admin = 1,
                    status = 'active'
                WHERE user_id = %s
            """, (name, hashed_password, existing["user_id"]))

            user_id = existing["user_id"]

        else:
            cur.execute("""
                INSERT INTO users
                    (name, email, password, is_admin, status, reputation_points)
                VALUES
                    (%s, %s, %s, 1, 'active', 100)
            """, (name, email, hashed_password))

            user_id = cur.lastrowid

        cnx.commit()

        return jsonify({
            "success": True,
            "message": (
                "First administrator account created successfully. "
                "You can now log in."
            ),
            "user_id": user_id,
            "email": email
        }), 201

    except Exception:
        if cnx:
            cnx.rollback()

        current_app.logger.exception("Setup first admin failed")

        return jsonify({
            "success": False,
            "message": "Could not initialize admin account."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/verify", methods=["GET"])
@require_admin
def admin_verify():
    return jsonify({
        "success": True,
        "message": "Admin session valid.",
        "user": request.admin_user
    }), 200


# =========================================================
# 2. DASHBOARD OVERVIEW & METRICS
# =========================================================

@admin_bp.route("/stats", methods=["GET"])
@require_admin
def admin_stats():
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("SELECT COUNT(*) AS count FROM users")
        total_users = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM blogs")
        total_blogs = cur.fetchone()["count"]

        try:
            cur.execute("SELECT COUNT(*) AS count FROM drafts")
            total_drafts = cur.fetchone()["count"]
        except Exception:
            total_drafts = 0

        cur.execute("SELECT COUNT(*) AS count FROM comments")
        total_comments = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM questions")
        total_questions = cur.fetchone()["count"]

        cur.execute("SELECT COUNT(*) AS count FROM support_requests")
        total_support = cur.fetchone()["count"]

        cur.execute("""
            SELECT COUNT(*) AS count
            FROM support_requests
            WHERE status = 'Open' OR status = 'In Progress'
        """)
        open_support = cur.fetchone()["count"]

        cur.execute("""
            SELECT
                'blog' AS type,
                b.blog_id AS id,
                b.title AS title,
                u.name AS author,
                b.created_at
            FROM blogs b
            LEFT JOIN users u ON b.author_id = u.user_id
            ORDER BY b.created_at DESC
            LIMIT 5
        """)
        recent_blogs = cur.fetchall()

        cur.execute("""
            SELECT
                'comment' AS type,
                c.comment_id AS id,
                c.comment AS title,
                u.name AS author,
                c.created_at
            FROM comments c
            LEFT JOIN users u ON c.user_id = u.user_id
            ORDER BY c.created_at DESC
            LIMIT 5
        """)
        recent_comments = cur.fetchall()

        cur.execute("""
            SELECT
                'ticket' AS type,
                s.support_id AS id,
                s.subject AS title,
                u.name AS author,
                s.created_at
            FROM support_requests s
            LEFT JOIN users u ON s.user_id = u.user_id
            ORDER BY s.created_at DESC
            LIMIT 5
        """)
        recent_tickets = cur.fetchall()

        activity = recent_blogs + recent_comments + recent_tickets

        for item in activity:
            if item.get("created_at"):
                item["created_at"] = item["created_at"].isoformat()

        activity.sort(
            key=lambda x: x.get("created_at") or "",
            reverse=True
        )

        return jsonify({
            "success": True,
            "stats": {
                "total_users": total_users,
                "total_blogs": total_blogs,
                "total_drafts": total_drafts,
                "total_comments": total_comments,
                "total_questions": total_questions,
                "total_support_requests": total_support,
                "open_support_requests": open_support
            },
            "recent_activity": activity[:10]
        }), 200

    except Exception:
        current_app.logger.exception("Error loading admin stats")
        return jsonify({
            "success": False,
            "message": "Could not load stats."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


# =========================================================
# 3. BLOG MANAGEMENT
# =========================================================

@admin_bp.route("/blogs", methods=["GET"])
@require_admin
def admin_get_blogs():
    search = clean_text(request.args.get("q", ""))
    topic = clean_text(request.args.get("topic", ""))

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        query = """
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.topic,
                b.template_id,
                b.cover_url,
                b.created_at,
                b.author_id,
                u.name AS author_name,
                u.email AS author_email,
                (
                    SELECT COUNT(*)
                    FROM comments c
                    WHERE c.blog_id = b.blog_id
                ) AS comments_count
            FROM blogs b
            LEFT JOIN users u ON b.author_id = u.user_id
            WHERE 1=1
        """

        params = []

        if search:
            query += """
                AND (
                    b.title LIKE %s
                    OR b.subtitle LIKE %s
                    OR u.name LIKE %s
                )
            """
            pattern = f"%{search}%"
            params.extend([pattern, pattern, pattern])

        if topic and topic.lower() != "all":
            query += " AND b.topic = %s"
            params.append(topic)

        query += " ORDER BY b.created_at DESC, b.blog_id DESC"

        cur.execute(query, tuple(params))
        blogs = cur.fetchall()

        for blog in blogs:
            if blog.get("created_at"):
                blog["created_at"] = blog["created_at"].isoformat()

        return jsonify({
            "success": True,
            "blogs": blogs,
            "count": len(blogs)
        }), 200

    except Exception:
        current_app.logger.exception("Admin fetch blogs failed")
        return jsonify({
            "success": False,
            "message": "Could not fetch blogs."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/blogs/<int:blog_id>", methods=["GET"])
@require_admin
def admin_get_single_blog(blog_id):
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.topic,
                b.template_id,
                b.cover_url,
                b.content,
                b.created_at,
                b.author_id,
                u.name AS author_name,
                u.email AS author_email
            FROM blogs b
            LEFT JOIN users u ON b.author_id = u.user_id
            WHERE b.blog_id = %s
        """, (blog_id,))

        blog = cur.fetchone()

        if not blog:
            return jsonify({
                "success": False,
                "message": "Blog not found."
            }), 404

        if blog.get("created_at"):
            blog["created_at"] = blog["created_at"].isoformat()

        return jsonify({
            "success": True,
            "blog": blog
        }), 200

    except Exception:
        current_app.logger.exception("Admin get single blog error")
        return jsonify({
            "success": False,
            "message": "Could not get blog."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/blogs/<int:blog_id>", methods=["PUT"])
@require_admin
def admin_update_blog(blog_id):
    data = request.get_json(silent=True) or {}

    title = clean_text(data.get("title"))
    subtitle = clean_text(data.get("subtitle"))
    topic = clean_text(data.get("topic")) or "Personal Stories"
    cover_url = clean_text(data.get("cover_url"))
    template_id = clean_text(data.get("template_id")) or "scrapbook"
    content = str(data.get("content") or "").strip()

    if not title or not content:
        return jsonify({
            "success": False,
            "message": "Title and content are required."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "SELECT blog_id FROM blogs WHERE blog_id = %s",
            (blog_id,)
        )

        if not cur.fetchone():
            return jsonify({
                "success": False,
                "message": "Blog not found."
            }), 404

        cur.execute("""
            UPDATE blogs
            SET
                title = %s,
                subtitle = %s,
                topic = %s,
                cover_url = %s,
                template_id = %s,
                content = %s
            WHERE blog_id = %s
        """, (
            title,
            subtitle or None,
            topic,
            cover_url or None,
            template_id,
            content,
            blog_id
        ))

        cnx.commit()

        return jsonify({
            "success": True,
            "message": "Story updated successfully."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        current_app.logger.exception("Admin update blog failed")

        return jsonify({
            "success": False,
            "message": "Could not update blog."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/blogs/<int:blog_id>", methods=["DELETE"])
@require_admin
def admin_delete_blog(blog_id):
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "DELETE FROM comments WHERE blog_id = %s",
            (blog_id,)
        )
        cur.execute(
            "DELETE FROM questions WHERE blog_id = %s",
            (blog_id,)
        )
        cur.execute(
            "DELETE FROM blogs WHERE blog_id = %s",
            (blog_id,)
        )

        deleted = cur.rowcount
        cnx.commit()

        if deleted == 0:
            return jsonify({
                "success": False,
                "message": "Blog not found."
            }), 404

        return jsonify({
            "success": True,
            "message": "Blog and related content deleted."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        current_app.logger.exception("Admin delete blog failed")

        return jsonify({
            "success": False,
            "message": "Could not delete blog."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


# =========================================================
# 4. USER MANAGEMENT
# =========================================================

@admin_bp.route("/users", methods=["GET"])
@require_admin
def admin_get_users():
    search = clean_text(request.args.get("q", ""))
    status_filter = clean_text(request.args.get("status", ""))

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        query = """
            SELECT
                u.user_id,
                u.name,
                u.email,
                u.reputation_points,
                COALESCE(u.is_admin, 0) AS is_admin,
                COALESCE(u.status, 'active') AS status,
                u.created_at,
                (
                    SELECT COUNT(*)
                    FROM blogs b
                    WHERE b.author_id = u.user_id
                ) AS blogs_count
            FROM users u
            WHERE 1=1
        """

        params = []

        if search:
            query += " AND (u.name LIKE %s OR u.email LIKE %s)"
            pattern = f"%{search}%"
            params.extend([pattern, pattern])

        if status_filter and status_filter.lower() != "all":
            query += " AND u.status = %s"
            params.append(status_filter)

        query += " ORDER BY u.user_id DESC"

        cur.execute(query, tuple(params))
        users = cur.fetchall()

        for user in users:
            if user.get("created_at"):
                user["created_at"] = user["created_at"].isoformat()

            user["is_admin"] = bool(user.get("is_admin"))

        return jsonify({
            "success": True,
            "users": users,
            "count": len(users)
        }), 200

    except Exception:
        current_app.logger.exception("Admin fetch users failed")
        return jsonify({
            "success": False,
            "message": "Could not fetch users."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/users/<int:user_id>/status", methods=["PUT"])
@require_admin
def admin_set_user_status(user_id):
    data = request.get_json(silent=True) or {}
    new_status = clean_text(data.get("status"))

    if new_status not in ("active", "suspended", "banned"):
        return jsonify({
            "success": False,
            "message": "Invalid status value."
        }), 400

    if (
        user_id == request.admin_user["user_id"]
        and new_status != "active"
    ):
        return jsonify({
            "success": False,
            "message": "You cannot suspend or ban your own account."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (user_id,)
        )

        if not cur.fetchone():
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        cur.execute(
            "UPDATE users SET status = %s WHERE user_id = %s",
            (new_status, user_id)
        )

        cnx.commit()

        return jsonify({
            "success": True,
            "message": f"User status set to {new_status}."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        return jsonify({
            "success": False,
            "message": "Could not update user status."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/users/<int:user_id>/role", methods=["PUT"])
@require_admin
def admin_set_user_role(user_id):
    data = request.get_json(silent=True) or {}
    is_admin = 1 if data.get("is_admin") else 0

    if (
        user_id == request.admin_user["user_id"]
        and not is_admin
    ):
        return jsonify({
            "success": False,
            "message": "You cannot revoke your own admin rights."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (user_id,)
        )

        if not cur.fetchone():
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        cur.execute(
            "UPDATE users SET is_admin = %s WHERE user_id = %s",
            (is_admin, user_id)
        )

        cnx.commit()

        return jsonify({
            "success": True,
            "message": (
                "User role updated to "
                f"{'Admin' if is_admin else 'Standard User'}."
            )
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        return jsonify({
            "success": False,
            "message": "Could not update user role."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/users/<int:user_id>", methods=["DELETE"])
@require_admin
def admin_delete_user(user_id):
    if user_id == request.admin_user["user_id"]:
        return jsonify({
            "success": False,
            "message": "You cannot delete your own account."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute("DELETE FROM comments WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM questions WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM answers WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM support_requests WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM reading_history WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM user_interests WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM user_preferences WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM user_templates WHERE user_id = %s", (user_id,))

        try:
            cur.execute(
                "DELETE FROM drafts WHERE user_id = %s",
                (user_id,)
            )
        except Exception:
            pass

        cur.execute("DELETE FROM blogs WHERE author_id = %s", (user_id,))
        cur.execute("DELETE FROM users WHERE user_id = %s", (user_id,))

        cnx.commit()

        return jsonify({
            "success": True,
            "message": "User and associated data deleted."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        current_app.logger.exception("Admin delete user failed")

        return jsonify({
            "success": False,
            "message": "Could not delete user."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


# =========================================================
# 5. COMMUNITY MODERATION (COMMENTS & QUESTIONS)
# =========================================================

@admin_bp.route("/comments", methods=["GET"])
@require_admin
def admin_get_comments():
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT
                c.comment_id,
                c.comment,
                c.created_at,
                c.blog_id,
                b.title AS blog_title,
                c.user_id,
                u.name AS user_name,
                u.email AS user_email
            FROM comments c
            LEFT JOIN blogs b ON c.blog_id = b.blog_id
            LEFT JOIN users u ON c.user_id = u.user_id
            ORDER BY c.created_at DESC
            LIMIT 100
        """)

        comments = cur.fetchall()

        for comment in comments:
            if comment.get("created_at"):
                comment["created_at"] = comment["created_at"].isoformat()

        return jsonify({
            "success": True,
            "comments": comments,
            "count": len(comments)
        }), 200

    except Exception:
        current_app.logger.exception("Admin get comments failed")
        return jsonify({
            "success": False,
            "message": "Could not fetch comments."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/comments/<int:comment_id>", methods=["DELETE"])
@require_admin
def admin_delete_comment(comment_id):
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "DELETE FROM comments WHERE comment_id = %s",
            (comment_id,)
        )

        cnx.commit()

        if cur.rowcount == 0:
            return jsonify({
                "success": False,
                "message": "Comment not found."
            }), 404

        return jsonify({
            "success": True,
            "message": "Comment removed by administrator."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        return jsonify({
            "success": False,
            "message": "Could not delete comment."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/questions", methods=["GET"])
@require_admin
def admin_get_questions():
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT
                q.question_id,
                q.question,
                q.created_at,
                q.blog_id,
                b.title AS blog_title,
                q.user_id,
                u.name AS user_name
            FROM questions q
            LEFT JOIN blogs b ON q.blog_id = b.blog_id
            LEFT JOIN users u ON q.user_id = u.user_id
            ORDER BY q.created_at DESC
            LIMIT 100
        """)

        questions = cur.fetchall()

        for question in questions:
            if question.get("created_at"):
                question["created_at"] = question["created_at"].isoformat()

        return jsonify({
            "success": True,
            "questions": questions,
            "count": len(questions)
        }), 200

    except Exception:
        current_app.logger.exception("Admin get questions failed")
        return jsonify({
            "success": False,
            "message": "Could not fetch questions."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/questions/<int:question_id>", methods=["DELETE"])
@require_admin
def admin_delete_question(question_id):
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "DELETE FROM answers WHERE question_id = %s",
            (question_id,)
        )
        cur.execute(
            "DELETE FROM questions WHERE question_id = %s",
            (question_id,)
        )

        deleted = cur.rowcount
        cnx.commit()

        if deleted == 0:
            return jsonify({
                "success": False,
                "message": "Question not found."
            }), 404

        return jsonify({
            "success": True,
            "message": "Question removed."
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        return jsonify({
            "success": False,
            "message": "Could not delete question."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


# =========================================================
# 6. SUPPORT REQUEST MANAGEMENT
# =========================================================

@admin_bp.route("/support", methods=["GET"])
@require_admin
def admin_get_support():
    status = clean_text(request.args.get("status", ""))

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        query = """
            SELECT
                s.support_id,
                s.user_id,
                s.subject,
                s.category,
                s.description,
                s.status,
                s.created_at,
                u.name AS user_name,
                u.email AS user_email
            FROM support_requests s
            LEFT JOIN users u ON s.user_id = u.user_id
            WHERE 1=1
        """

        params = []

        if status and status.lower() != "all":
            query += " AND s.status = %s"
            params.append(status)

        query += " ORDER BY s.created_at DESC, s.support_id DESC"

        cur.execute(query, tuple(params))
        requests_list = cur.fetchall()

        for support_request in requests_list:
            if support_request.get("created_at"):
                support_request["created_at"] = (
                    support_request["created_at"].isoformat()
                )

        return jsonify({
            "success": True,
            "requests": requests_list,
            "count": len(requests_list)
        }), 200

    except Exception:
        current_app.logger.exception(
            "Admin get support requests failed"
        )
        return jsonify({
            "success": False,
            "message": "Could not load support requests."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/support/<int:support_id>", methods=["GET"])
@require_admin
def admin_get_single_support(support_id):
    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor(dictionary=True)

        cur.execute("""
            SELECT
                s.support_id,
                s.user_id,
                s.subject,
                s.category,
                s.description,
                s.status,
                s.created_at,
                u.name AS user_name,
                u.email AS user_email
            FROM support_requests s
            LEFT JOIN users u ON s.user_id = u.user_id
            WHERE s.support_id = %s
        """, (support_id,))

        req = cur.fetchone()

        if not req:
            return jsonify({
                "success": False,
                "message": "Support request not found."
            }), 404

        if req.get("created_at"):
            req["created_at"] = req["created_at"].isoformat()

        return jsonify({
            "success": True,
            "request": req
        }), 200

    except Exception:
        current_app.logger.exception(
            "Admin get single support ticket failed"
        )
        return jsonify({
            "success": False,
            "message": "Could not get support request."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()


@admin_bp.route("/support/<int:support_id>/status", methods=["PUT"])
@require_admin
def admin_update_support_status(support_id):
    data = request.get_json(silent=True) or {}
    new_status = clean_text(data.get("status"))

    if new_status not in ("Open", "In Progress", "Resolved", "Closed"):
        return jsonify({
            "success": False,
            "message": "Invalid support status."
        }), 400

    cnx = None
    cur = None

    try:
        cnx = get_db()
        cur = cnx.cursor()

        cur.execute(
            "SELECT support_id FROM support_requests WHERE support_id = %s",
            (support_id,)
        )

        if not cur.fetchone():
            return jsonify({
                "success": False,
                "message": "Support request not found."
            }), 404

        cur.execute("""
            UPDATE support_requests
            SET status = %s
            WHERE support_id = %s
        """, (new_status, support_id))

        cnx.commit()

        return jsonify({
            "success": True,
            "message": (
                f"Support request #{support_id} "
                f"status updated to {new_status}."
            )
        }), 200

    except Exception:
        if cnx:
            cnx.rollback()

        return jsonify({
            "success": False,
            "message": "Could not update support status."
        }), 500

    finally:
        if cur:
            cur.close()

        if cnx and cnx.is_connected():
            cnx.close()
