import os
import re
import uuid
from functools import wraps

from flask import (
    Flask,
    request,
    jsonify,
    send_from_directory
)
from flask_cors import CORS
from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired
)
from werkzeug.security import (
    generate_password_hash,
    check_password_hash
)
from werkzeug.utils import secure_filename

import mysql.connector
from mysql.connector import IntegrityError, Error

from PIL import Image, UnidentifiedImageError

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from semantic_search import semantic_search_engine
from recommendation_engine import recommendation_engine


# =========================
# APP CONFIGURATION
# =========================

app = Flask(__name__)
CORS(app)

MAX_TEMPLATE_SIZE = 1536 * 1024

app.config["MAX_CONTENT_LENGTH"] = MAX_TEMPLATE_SIZE

app.config["TEMPLATE_UPLOAD_FOLDER"] = os.path.join(
    app.root_path,
    "uploads",
    "templates"
)

os.makedirs(
    app.config["TEMPLATE_UPLOAD_FOLDER"],
    exist_ok=True
)

app.config["SECRET_KEY"] = (
    os.getenv("SMARTBLOG_SECRET_KEY")
    or "smartblog-dev-secret-key-2026"
)

token_serializer = URLSafeTimedSerializer(
    app.config["SECRET_KEY"],
    salt="smartblog-login"
)

ALLOWED_TEMPLATE_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp"
}


# =========================
# DATABASE CONNECTION
# =========================

def get_db_connection():
    try:
        db_password = os.getenv("SMARTBLOG_DB_PASSWORD")
        if db_password is None:
            db_password = "nishasahni@2626"

        return mysql.connector.connect(
            host=os.getenv("SMARTBLOG_DB_HOST", "localhost"),
            user=os.getenv("SMARTBLOG_DB_USER", "root"),
            password=db_password,
            database=os.getenv("SMARTBLOG_DB_NAME", "smartblog")
        )

    except mysql.connector.Error as error:
        app.logger.error(
            "MySQL connection failed: %s",
            error
        )
        raise


# =========================
# COMMON HELPERS
# =========================

def get_json_data():
    return request.get_json(silent=True) or {}


def clean_text(value):
    if value is None:
        return ""

    return re.sub(
        r"\s+",
        " ",
        str(value)
    ).strip()


def get_author_level(points):
    if points >= 500:
        return "Top Blogger"
    elif points >= 300:
        return "Expert"
    elif points >= 150:
        return "Advanced"
    elif points >= 50:
        return "Intermediate"

    return "Beginner"


# =========================
# AUTHENTICATION
# =========================

def create_auth_token(user_id):
    return token_serializer.dumps({
        "user_id": user_id
    })


def require_auth(function):

    @wraps(function)
    def wrapper(*args, **kwargs):

        auth_header = request.headers.get(
            "Authorization",
            ""
        )

        if not auth_header.startswith("Bearer "):
            return jsonify({
                "success": False,
                "message": "Authentication required."
            }), 401

        token = auth_header.split(
            " ",
            1
        )[1].strip()

        try:
            payload = token_serializer.loads(
                token,
                max_age=60 * 60 * 24 * 7
            )

            request.authenticated_user_id = int(
                payload["user_id"]
            )

        except (
            BadSignature,
            SignatureExpired,
            ValueError,
            TypeError,
            KeyError
        ):
            return jsonify({
                "success": False,
                "message": (
                    "Invalid or expired login. "
                    "Please log in again."
                )
            }), 401

        return function(*args, **kwargs)

    return wrapper


# =========================
# BLOG FETCHING
# =========================

def fetch_blogs():

    connection = get_db_connection()

    try:
        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.topic,
                b.cover_url,
                b.template_id,
                b.content,
                b.author_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u
                ON b.author_id = u.user_id
            ORDER BY
                b.created_at DESC,
                b.blog_id DESC
        """)

        blogs = cursor.fetchall()

        for blog in blogs:

            blog["title"] = clean_text(
                blog.get("title")
            )

            blog["subtitle"] = clean_text(
                blog.get("subtitle")
            )

            blog["topic"] = (
                clean_text(blog.get("topic"))
                or "Personal Stories"
            )

            blog["cover_url"] = clean_text(
                blog.get("cover_url")
            )
            blog["image"] = blog["cover_url"]
            blog["image_url"] = blog["cover_url"]

            blog["template_id"] = (
                clean_text(blog.get("template_id"))
                or "scrapbook"
            )

            blog["content"] = clean_text(
                blog.get("content")
            )

            blog["author_name"] = (
                clean_text(blog.get("author_name"))
                or "SmartBlog writer"
            )
            blog["author"] = blog["author_name"]

            if blog.get("created_at"):
                blog["created_at"] = (
                    blog["created_at"].isoformat()
                )
            else:
                blog["created_at"] = None

            blog["excerpt"] = blog["content"][:220]
            blog["description"] = (
                blog["subtitle"]
                or blog["excerpt"]
            )

        cursor.close()

        return blogs

    finally:
        connection.close()


# =========================
# NLP SEMANTIC SEARCH
# =========================

def find_search_results(query, blogs, threshold=None, limit=50, fields=None):
    return semantic_search_engine.search(
        query=query,
        blogs=blogs,
        threshold=threshold,
        limit=limit,
        fields=fields
    )

# =========================
# PERSONALIZED RECOMMENDATIONS
# =========================

@app.route("/recommendations", methods=["GET"])
@require_auth
def get_recommendations():

    user_id = request.authenticated_user_id

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # --------------------------------------
        # 1. FETCH USER'S SELECTED INTERESTS
        # --------------------------------------
        cursor.execute("""
            SELECT interest
            FROM user_interests
            WHERE user_id = %s
            ORDER BY interest_id
        """, (user_id,))

        interests = [
            clean_text(row["interest"])
            for row in cursor.fetchall()
            if clean_text(row["interest"])
        ]

        # --------------------------------------
        # 2. FETCH USER'S READING HISTORY
        # --------------------------------------
        cursor.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.topic,
                b.content,
                rh.read_at
            FROM reading_history rh
            JOIN blogs b
                ON rh.blog_id = b.blog_id
            WHERE rh.user_id = %s
            ORDER BY rh.read_at DESC
            LIMIT 10
        """, (user_id,))

        reading_history = cursor.fetchall()

        # --------------------------------------
        # 3. FETCH CANDIDATE BLOGS
        # --------------------------------------
        cursor.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.content,
                b.topic,
                b.cover_url,
                b.template_id,
                b.author_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u
                ON b.author_id = u.user_id
            WHERE b.author_id != %s
            ORDER BY
                b.created_at DESC,
                b.blog_id DESC
        """, (user_id,))

        candidate_blogs = cursor.fetchall()

        # If user is author of all blogs or database has only user's blogs, fallback to all blogs
        if not candidate_blogs:
            cursor.execute("""
                SELECT
                    b.blog_id,
                    b.title,
                    b.subtitle,
                    b.content,
                    b.topic,
                    b.cover_url,
                    b.template_id,
                    b.author_id,
                    b.created_at,
                    u.name AS author_name
                FROM blogs b
                LEFT JOIN users u
                    ON b.author_id = u.user_id
                ORDER BY
                    b.created_at DESC,
                    b.blog_id DESC
            """)
            candidate_blogs = cursor.fetchall()

        # Normalize blog records
        for blog in candidate_blogs:
            blog["title"] = clean_text(blog.get("title"))
            blog["subtitle"] = clean_text(blog.get("subtitle"))
            blog["topic"] = (
                clean_text(blog.get("topic"))
                or "Personal Stories"
            )
            blog["content"] = clean_text(blog.get("content"))
            blog["cover_url"] = clean_text(blog.get("cover_url"))
            blog["image"] = blog["cover_url"]
            blog["image_url"] = blog["cover_url"]
            blog["template_id"] = (
                clean_text(blog.get("template_id"))
                or "scrapbook"
            )
            blog["author_name"] = (
                clean_text(blog.get("author_name"))
                or "SmartBlog writer"
            )
            blog["author"] = blog["author_name"]
            blog["excerpt"] = blog["content"][:220]
            blog["description"] = (
                blog["subtitle"]
                or blog["excerpt"]
            )
            if blog.get("created_at"):
                blog["created_at"] = blog["created_at"].isoformat()
            else:
                blog["created_at"] = None

        # Fetch optional saved blogs if requested
        saved_ids_param = request.args.get("saved_ids")
        saved_blogs = []
        if saved_ids_param:
            try:
                saved_ids = [int(s.strip()) for s in saved_ids_param.split(",") if s.strip().isdigit()]
                if saved_ids:
                    saved_blogs = [b for b in candidate_blogs if b["blog_id"] in saved_ids]
            except Exception:
                pass

        limit_param = request.args.get("limit", 6, type=int)

        recommendations = recommendation_engine.generate_recommendations(
            user_id=user_id,
            interests=interests,
            reading_history=reading_history,
            candidate_blogs=candidate_blogs,
            saved_blogs=saved_blogs,
            limit=limit_param
        )

        return jsonify({
            "success": True,
            "method": "nlp_semantic_recommendation",
            "model": "all-MiniLM-L6-v2",
            "recommendations": recommendations,
            "count": len(recommendations),
            "personalization": {
                "interests_count": len(interests),
                "reading_history_count": len(reading_history),
                "interests": interests
            }
        }), 200

    except Error:
        app.logger.exception("Could not generate personalized recommendations.")
        return jsonify({
            "success": False,
            "message": "Could not generate recommendations."
        }), 500

    except Exception:
        app.logger.exception("Recommendation processing error.")
        return jsonify({
            "success": False,
            "message": "Could not generate recommendations."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# =========================
# HOME
# =========================

@app.route("/", methods=["GET"])
def home():
    return "SmartBlog Backend is running!"


# =========================
# DATABASE TEST
# =========================

@app.route("/db-test", methods=["GET"])
def db_test():

    connection = None

    try:
        connection = get_db_connection()

        if connection.is_connected():
            return jsonify({
                "message": "MySQL connection successful!"
            }), 200

        return jsonify({
            "message": "MySQL connection failed."
        }), 500

    except mysql.connector.Error:

        app.logger.exception(
            "Database test failed"
        )

        return jsonify({
            "message": (
                "Could not connect to MySQL. "
                "Check your configuration."
            )
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# =========================
# SIGNUP
# =========================

@app.route("/signup", methods=["POST"])
def signup():

    data = get_json_data()

    name = clean_text(data.get("name"))
    email = clean_text(data.get("email")).lower()
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({
            "success": False,
            "message": "All fields are required."
        }), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "success": False,
            "message": "Password must contain at least 8 characters."
        }), 400

    hashed_password = generate_password_hash(password)

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO users
                (name, email, password)
            VALUES (%s, %s, %s)
        """, (
            name,
            email,
            hashed_password
        ))

        user_id = cursor.lastrowid

        auth_token = create_auth_token(user_id)

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Account created successfully!",
            "user_id": user_id,
            "name": name,
            "email": email,
            "token": auth_token
        }), 201

    except IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "success": False,
            "message": "An account with this email may already exist."
        }), 409

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception("Signup database error")

        return jsonify({
            "success": False,
            "message": "Could not create your account."
        }), 500

    except Exception:

        if connection:
            connection.rollback()

        app.logger.exception("Signup error")

        return jsonify({
            "success": False,
            "message": "Something went wrong during signup."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# LOGIN
# =========================

@app.route("/login", methods=["POST"])
def login():

    data = get_json_data()

    email = clean_text(
        data.get("email")
    ).lower()

    password = data.get("password")

    if not email or not password:
        return jsonify({
            "message": (
                "Email and password are required."
            )
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT
                user_id,
                name,
                email,
                password
            FROM users
            WHERE email = %s
        """, (email,))

        user = cursor.fetchone()

        if user and check_password_hash(
            user[3],
            password
        ):

            auth_token = create_auth_token(
                user[0]
            )

            return jsonify({
                "message": "Login successful!",
                "user_id": user[0],
                "name": user[1],
                "email": user[2],
                "token": auth_token
            }), 200

        return jsonify({
            "message": "Invalid email or password."
        }), 401

    except Error:

        app.logger.exception(
            "Login database error"
        )

        return jsonify({
            "message": "Could not complete login."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# GET ALL BLOGS
# =========================

@app.route("/blogs", methods=["GET"])
def get_blogs():

    try:
        blogs = fetch_blogs()

        return jsonify({
            "blogs": blogs,
            "count": len(blogs)
        }), 200

    except Error:

        app.logger.exception(
            "Could not retrieve blogs"
        )

        return jsonify({
            "message": "Could not retrieve blogs."
        }), 500


# =========================
# GET SINGLE BLOG
# =========================

@app.route("/blogs/<int:blog_id>", methods=["GET"])
def get_blog(blog_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.content,
                b.author_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u
                ON b.author_id = u.user_id
            WHERE b.blog_id = %s
        """, (blog_id,))

        blog = cursor.fetchone()

        if not blog:
            return jsonify({
                "message": "Blog not found."
            }), 404

        blog["author_name"] = (
            clean_text(blog.get("author_name"))
            or "SmartBlog writer"
        )

        blog["excerpt"] = clean_text(
            blog.get("content")
        )[:220]

        if blog.get("created_at"):
            blog["created_at"] = (
                blog["created_at"].isoformat()
            )
        else:
            blog["created_at"] = None

        reader_id = request.args.get(
            "user_id",
            type=int
        )

        if not reader_id:
            auth_header = request.headers.get("Authorization", "")
            if auth_header.startswith("Bearer "):
                try:
                    payload = token_serializer.loads(
                        auth_header.split(" ", 1)[1].strip(),
                        max_age=60 * 60 * 24 * 7
                    )
                    reader_id = int(payload.get("user_id"))
                except Exception:
                    pass

        if reader_id and reader_id > 0:

            cursor.execute(
                "SELECT user_id FROM users WHERE user_id = %s",
                (reader_id,)
            )

            reader = cursor.fetchone()

            if reader and reader_id != blog["author_id"]:

                cursor.execute("""
                    SELECT history_id
                    FROM reading_history
                    WHERE user_id = %s
                      AND blog_id = %s
                    LIMIT 1
                """, (
                    reader_id,
                    blog_id
                ))

                already_read = cursor.fetchone()

                if not already_read:

                    cursor.execute("""
                        INSERT INTO reading_history
                            (user_id, blog_id)
                        VALUES (%s, %s)
                    """, (
                        reader_id,
                        blog_id
                    ))

                    cursor.execute("""
                        UPDATE users
                        SET reputation_points =
                            reputation_points + 1
                        WHERE user_id = %s
                    """, (
                        blog["author_id"],
                    ))

                    connection.commit()

        return jsonify({
            "blog": blog
        }), 200

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Could not retrieve blog"
        )

        return jsonify({
            "message": "Could not retrieve blog."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# CREATE BLOG
# =========================

@app.route("/blogs", methods=["POST"])
@require_auth
def create_blog():

    data = get_json_data()

    title = clean_text(data.get("title"))
    subtitle = clean_text(data.get("subtitle"))
    topic = clean_text(data.get("topic")) or "Personal Stories"
    cover_url = clean_text(data.get("cover_url"))
    template_id = clean_text(data.get("template_id")) or "scrapbook"

    content = str(data.get("content") or "").strip()

    author_id = request.authenticated_user_id

    if not title or not content:
        return jsonify({
            "success": False,
            "message": "Title and story content are required."
        }), 400

    if len(title) > 200:
        return jsonify({
            "success": False,
            "message": "Title must be 200 characters or fewer."
        }), 400

    if len(subtitle) > 300:
        return jsonify({
            "success": False,
            "message": "Introduction must be 300 characters or fewer."
        }), 400

    if len(topic) > 100 or len(template_id) > 100:
        return jsonify({
            "success": False,
            "message": "Invalid topic or template selection."
        }), 400

    if len(content) > 100000:
        return jsonify({
            "success": False,
            "message": "Story content is too long."
        }), 400

    if cover_url:
        from urllib.parse import urlparse

        parsed_url = urlparse(cover_url)

        if parsed_url.scheme not in ("http", "https") or not parsed_url.netloc:
            return jsonify({
                "success": False,
                "message": "Please provide a valid cover image URL."
            }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO blogs
                (title, subtitle, topic, cover_url,
                 template_id, content, author_id)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            title,
            subtitle or None,
            topic,
            cover_url or None,
            template_id,
            content,
            author_id
        ))

        new_blog_id = cursor.lastrowid
        connection.commit()

        try:
            semantic_search_engine.update_blog({
                "blog_id": new_blog_id,
                "title": title,
                "subtitle": subtitle,
                "topic": topic,
                "cover_url": cover_url,
                "template_id": template_id,
                "content": content,
                "author_id": author_id
            })
        except Exception:
            app.logger.warning("Failed to immediately update semantic embedding for new blog %s", new_blog_id)

        return jsonify({
            "success": True,
            "message": "Your story has been published!",
            "blog": {
                "blog_id": new_blog_id,
                "title": title,
                "subtitle": subtitle,
                "topic": topic,
                "cover_url": cover_url,
                "template_id": template_id,
                "content": content,
                "author_id": author_id
            }
        }), 201

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception("Could not publish blog")

        return jsonify({
            "success": False,
            "message": "Could not publish your story."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# UPDATE EXISTING BLOG
# =========================

@app.route("/blogs/<int:blog_id>", methods=["PUT"])
@require_auth
def update_blog(blog_id):

    data = get_json_data()

    author_id = request.authenticated_user_id

    title = clean_text(data.get("title"))
    subtitle = clean_text(data.get("subtitle"))
    topic = clean_text(data.get("topic")) or "Personal Stories"
    content = str(data.get("content") or "").strip()

    connection = None
    cursor = None

    if not title or not content:
        return jsonify({
            "success": False,
            "message": "Title and story content are required."
        }), 400

    if len(title) > 200:
        return jsonify({
            "success": False,
            "message": "Title must be 200 characters or fewer."
        }), 400

    if len(subtitle) > 300:
        return jsonify({
            "success": False,
            "message": "Introduction must be 300 characters or fewer."
        }), 400

    if len(topic) > 100:
        return jsonify({
            "success": False,
            "message": "Topic must be 100 characters or fewer."
        }), 400

    if len(content) > 100000:
        return jsonify({
            "success": False,
            "message": "Story content is too long."
        }), 400

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                blog_id,
                cover_url,
                template_id
            FROM blogs
            WHERE blog_id = %s
              AND author_id = %s
        """, (
            blog_id,
            author_id
        ))

        existing_blog = cursor.fetchone()

        if not existing_blog:
            return jsonify({
                "success": False,
                "message": "Blog not found or you are not allowed to edit it."
            }), 404

        submitted_cover_url = data.get("cover_url")

        if (
            submitted_cover_url is None
            or not str(submitted_cover_url).strip()
        ):
            cover_url = existing_blog.get("cover_url")
        else:
            cover_url = clean_text(submitted_cover_url)

        if cover_url:
            from urllib.parse import urlparse

            parsed_url = urlparse(cover_url)

            if (
                parsed_url.scheme not in ("http", "https")
                or not parsed_url.netloc
            ):
                return jsonify({
                    "success": False,
                    "message": "Please provide a valid cover image URL."
                }), 400

        submitted_template_id = clean_text(
            data.get("template_id")
        )

        template_id = (
            submitted_template_id
            or existing_blog.get("template_id")
            or "scrapbook"
        )

        if len(template_id) > 100:
            return jsonify({
                "success": False,
                "message": "Invalid template selection."
            }), 400

        cursor.execute("""
            UPDATE blogs
            SET
                title = %s,
                subtitle = %s,
                topic = %s,
                cover_url = %s,
                template_id = %s,
                content = %s
            WHERE blog_id = %s
              AND author_id = %s
        """, (
            title,
            subtitle or None,
            topic,
            cover_url,
            template_id,
            content,
            blog_id,
            author_id
        ))

        connection.commit()

        try:
            semantic_search_engine.update_blog({
                "blog_id": blog_id,
                "title": title,
                "subtitle": subtitle,
                "topic": topic,
                "cover_url": cover_url,
                "template_id": template_id,
                "content": content,
                "author_id": author_id
            })
        except Exception:
            app.logger.warning("Failed to immediately update semantic embedding for updated blog %s", blog_id)

        return jsonify({
            "success": True,
            "message": "Your story has been updated successfully!",
            "blog": {
                "blog_id": blog_id,
                "title": title,
                "subtitle": subtitle,
                "topic": topic,
                "cover_url": cover_url,
                "template_id": template_id,
                "content": content,
                "author_id": author_id
            }
        }), 200

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Could not update blog"
        )

        return jsonify({
            "success": False,
            "message": "Could not update your story."
        }), 500

    except Exception:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Unexpected blog update error"
        )

        return jsonify({
            "success": False,
            "message": "Something went wrong while updating your story."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# SEARCH BLOGS
# =========================

@app.route("/search", methods=["GET"])
def search_blogs():

    query = clean_text(
        request.args.get("q", "")
    )

    if len(query) > 500:
        return jsonify({
            "message": "Search query is too long."
        }), 400

    threshold_param = request.args.get("threshold")
    threshold = float(threshold_param) if threshold_param else None

    limit_param = request.args.get("limit")
    limit = int(limit_param) if limit_param else 50

    fields_param = request.args.get("fields")
    fields = [f.strip() for f in fields_param.split(",") if f.strip()] if fields_param else None

    try:
        blogs = fetch_blogs()

        if not query:
            return jsonify({
                "query": "",
                "method": "all_stories",
                "results": blogs[:limit],
                "count": len(blogs)
            }), 200

        results = find_search_results(
            query=query,
            blogs=blogs,
            threshold=threshold,
            limit=limit,
            fields=fields
        )

        used_threshold = (
            threshold if threshold is not None
            else semantic_search_engine.default_threshold
        )

        return jsonify({
            "query": query,
            "method": "nlp_semantic_search",
            "model": "all-MiniLM-L6-v2",
            "threshold": used_threshold,
            "results": results,
            "count": len(results)
        }), 200

    except Error:

        app.logger.exception(
            "Search database error"
        )

        return jsonify({
            "message": "Could not search blogs."
        }), 500

    except Exception:

        app.logger.exception(
            "Semantic search failure"
        )

        return jsonify({
            "message": "Could not complete semantic search."
        }), 500


# =========================
# READING HISTORY
# =========================

@app.route("/reading-history", methods=["GET"])
@require_auth
def get_user_reading_history():

    user_id = request.authenticated_user_id
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                rh.history_id,
                rh.read_at,
                b.blog_id,
                b.title,
                b.subtitle,
                b.topic,
                b.cover_url,
                b.author_id,
                u.name AS author_name
            FROM reading_history rh
            JOIN blogs b
                ON rh.blog_id = b.blog_id
            LEFT JOIN users u
                ON b.author_id = u.user_id
            WHERE rh.user_id = %s
            ORDER BY rh.read_at DESC
            LIMIT 20
        """, (user_id,))

        history = cursor.fetchall()

        for item in history:
            item["title"] = clean_text(item.get("title"))
            item["subtitle"] = clean_text(item.get("subtitle"))
            item["topic"] = clean_text(item.get("topic")) or "Personal Stories"
            item["author_name"] = clean_text(item.get("author_name")) or "SmartBlog writer"
            item["image"] = clean_text(item.get("cover_url"))
            item["cover_url"] = item["image"]
            if item.get("read_at"):
                item["read_at"] = item["read_at"].isoformat()
            else:
                item["read_at"] = None

        return jsonify({
            "success": True,
            "reading_history": history,
            "count": len(history)
        }), 200

    except Error:
        app.logger.exception("Could not fetch user reading history")
        return jsonify({
            "success": False,
            "message": "Could not load reading history."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# =========================
# LEADERBOARD
# =========================

@app.route("/leaderboard", methods=["GET"])
def get_leaderboard():

    connection = None
    cursor = None

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                user_id,
                name,
                reputation_points
            FROM users
            ORDER BY
                reputation_points DESC,
                user_id ASC
        """)

        authors = cursor.fetchall()

        for rank, author in enumerate(
            authors,
            start=1
        ):

            author["rank"] = rank

            author["level"] = get_author_level(
                author["reputation_points"]
            )

        return jsonify({
            "success": True,
            "leaderboard": authors
        }), 200

    except Error:

        app.logger.exception(
            "Could not load leaderboard"
        )

        return jsonify({
            "success": False,
            "message": "Could not load leaderboard."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# AUTHOR RANK
# =========================

@app.route("/authors/<int:user_id>/rank", methods=["GET"])
def get_author_rank(user_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                user_id,
                name,
                reputation_points
            FROM users
            WHERE user_id = %s
        """, (user_id,))

        author = cursor.fetchone()

        if not author:
            return jsonify({
                "success": False,
                "message": "Author not found."
            }), 404

        points = author["reputation_points"]

        cursor.execute("""
            SELECT COUNT(*) + 1 AS author_rank
            FROM users
            WHERE reputation_points > %s
               OR (
                    reputation_points = %s
                    AND user_id < %s
               )
        """, (
            points,
            points,
            user_id
        ))

        rank = cursor.fetchone()["author_rank"]

        return jsonify({
            "success": True,
            "user_id": author["user_id"],
            "name": author["name"],
            "rank": rank,
            "points": points,
            "level": get_author_level(points)
        }), 200

    except Error:

        app.logger.exception(
            "Could not load author rank"
        )

        return jsonify({
            "success": False,
            "message": "Could not load author rank."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# GET AUTHOR'S PUBLISHED BLOGS
# =========================

@app.route("/authors/<int:user_id>/blogs", methods=["GET"])
@require_auth
def get_author_blogs(user_id):

    # A user can only retrieve their own published blogs.
    if request.authenticated_user_id != user_id:
        return jsonify({
            "success": False,
            "message": "You can only view your own published stories."
        }), 403

    connection = None
    cursor = None

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                b.blog_id,
                b.title,
                b.subtitle,
                b.content,
                b.author_id,
                b.topic,
                b.cover_url,
                b.template_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u
                ON b.author_id = u.user_id
            WHERE b.author_id = %s
            ORDER BY
                b.created_at DESC,
                b.blog_id DESC
        """, (user_id,))

        rows = cursor.fetchall()

        blogs = []

        for blog in rows:

            content = blog.get("content") or ""

            blog["title"] = clean_text(
                blog.get("title")
            )

            blog["subtitle"] = clean_text(
                blog.get("subtitle")
            )

            blog["topic"] = (
                clean_text(blog.get("topic"))
                or "Personal Stories"
            )

            blog["author_name"] = (
                clean_text(blog.get("author_name"))
                or "SmartBlog writer"
            )

            blog["content"] = content

            blog["excerpt"] = (
                content[:220] + "..."
                if len(content) > 220
                else content
            )

            if blog.get("created_at"):
                blog["created_at"] = (
                    blog["created_at"].isoformat()
                )
            else:
                blog["created_at"] = None

            blogs.append(blog)

        return jsonify({
            "success": True,
            "count": len(blogs),
            "blogs": blogs
        }), 200

    except Error:

        app.logger.exception(
            "Could not retrieve author's published blogs"
        )

        return jsonify({
            "success": False,
            "message": "Could not fetch published stories."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# USER INTERESTS
# =========================

@app.route("/interests/<int:user_id>", methods=["GET"])
def get_interests(user_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            SELECT interest
            FROM user_interests
            WHERE user_id = %s
            ORDER BY interest_id
        """, (user_id,))

        interests = [
            row[0]
            for row in cursor.fetchall()
        ]

        return jsonify({
            "success": True,
            "interests": interests
        }), 200

    except Exception:

        app.logger.exception(
            "Error loading interests"
        )

        return jsonify({
            "success": False,
            "message": "Could not load interests."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


@app.route("/interests/<int:user_id>", methods=["PUT"])
def save_interests(user_id):

    connection = None
    cursor = None

    try:
        data = get_json_data()
        interests = data.get("interests")

        if not isinstance(interests, list):
            return jsonify({
                "success": False,
                "message": (
                    "Interests must be provided as a list."
                )
            }), 400

        cleaned_interests = []
        seen = set()

        for interest in interests:

            if not isinstance(interest, str):
                continue

            interest = interest.strip()

            if not interest or len(interest) > 100:
                continue

            normalized = interest.casefold()

            if normalized not in seen:
                seen.add(normalized)
                cleaned_interests.append(interest)

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (user_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        cursor.execute(
            "DELETE FROM user_interests WHERE user_id = %s",
            (user_id,)
        )

        if cleaned_interests:

            cursor.executemany("""
                INSERT INTO user_interests
                    (user_id, interest)
                VALUES (%s, %s)
            """, [
                (user_id, interest)
                for interest in cleaned_interests
            ])

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Interests saved successfully.",
            "interests": cleaned_interests
        }), 200

    except Exception:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Error saving interests"
        )

        return jsonify({
            "success": False,
            "message": "Could not save interests."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# CUSTOM USER TEMPLATES
# =========================

@app.route("/templates", methods=["POST"])
@require_auth
def upload_template():

    connection = None
    cursor = None
    saved_path = None

    user_id = request.authenticated_user_id

    template_name = clean_text(
        request.form.get("template_name")
    )

    image_file = request.files.get("image")

    if not template_name:
        return jsonify({
            "success": False,
            "message": "Please provide a template name."
        }), 400

    if len(template_name) > 100:
        return jsonify({
            "success": False,
            "message": (
                "Template name must be 100 characters or fewer."
            )
        }), 400

    if not image_file or not image_file.filename:
        return jsonify({
            "success": False,
            "message": "Please select an image."
        }), 400

    image_file.stream.seek(0, os.SEEK_END)

    file_size = image_file.stream.tell()

    image_file.stream.seek(0)

    if file_size == 0:
        return jsonify({
            "success": False,
            "message": "The selected image is empty."
        }), 400

    if file_size > MAX_TEMPLATE_SIZE:
        return jsonify({
            "success": False,
            "message": "Image must be 1.5 MB or smaller."
        }), 413

    try:
        image = Image.open(image_file.stream)

        image_format = image.format

        if image_format not in ALLOWED_TEMPLATE_FORMATS:
            return jsonify({
                "success": False,
                "message": (
                    "Only JPG, PNG and WebP images are allowed."
                )
            }), 400

        if getattr(image, "n_frames", 1) != 1:
            return jsonify({
                "success": False,
                "message": "Animated images are not supported."
            }), 400

        image.verify()

    except (
        UnidentifiedImageError,
        OSError,
        ValueError
    ):

        return jsonify({
            "success": False,
            "message": "The uploaded file is not a valid image."
        }), 400

    finally:
        image_file.stream.seek(0)

    extension = ALLOWED_TEMPLATE_FORMATS[
        image_format
    ]

    filename = f"{uuid.uuid4().hex}{extension}"

    saved_path = os.path.join(
        app.config["TEMPLATE_UPLOAD_FOLDER"],
        filename
    )

    image_path = f"/uploads/templates/{filename}"

    try:
        image_file.save(saved_path)

        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute("""
            INSERT INTO user_templates
                (
                    user_id,
                    template_name,
                    image_path,
                    image_type,
                    file_size
                )
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            template_name,
            image_path,
            image_format,
            file_size
        ))

        connection.commit()

        template_id = cursor.lastrowid

        return jsonify({
            "success": True,
            "message": "Template uploaded successfully!",
            "template": {
                "template_id": template_id,
                "template_name": template_name,
                "image_path": image_path,
                "image_type": image_format,
                "file_size": file_size
            }
        }), 201

    except Error:

        if connection:
            connection.rollback()

        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)

        app.logger.exception(
            "Template upload failed"
        )

        return jsonify({
            "success": False,
            "message": "Could not save your template."
        }), 500

    except OSError:

        if saved_path and os.path.exists(saved_path):
            os.remove(saved_path)

        app.logger.exception(
            "Could not store template image"
        )

        return jsonify({
            "success": False,
            "message": "Could not store the uploaded image."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# GET USER TEMPLATES
# =========================

@app.route("/templates", methods=["GET"])
@require_auth
def get_user_templates():

    connection = None
    cursor = None

    user_id = request.authenticated_user_id

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT
                template_id,
                template_name,
                image_path,
                image_type,
                file_size,
                created_at
            FROM user_templates
            WHERE user_id = %s
            ORDER BY
                created_at DESC,
                template_id DESC
        """, (user_id,))

        templates = cursor.fetchall()

        for template in templates:

            if template.get("created_at"):
                template["created_at"] = (
                    template["created_at"].isoformat()
                )

        return jsonify({
            "success": True,
            "templates": templates,
            "count": len(templates)
        }), 200

    except Error:

        app.logger.exception(
            "Could not fetch user templates"
        )

        return jsonify({
            "success": False,
            "message": "Could not load your templates."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# DELETE USER TEMPLATE
# =========================

@app.route("/templates/<int:template_id>", methods=["DELETE"])
@require_auth
def delete_user_template(template_id):

    connection = None
    cursor = None

    user_id = request.authenticated_user_id

    try:
        connection = get_db_connection()

        cursor = connection.cursor(
            dictionary=True
        )

        cursor.execute("""
            SELECT image_path
            FROM user_templates
            WHERE template_id = %s
              AND user_id = %s
        """, (
            template_id,
            user_id
        ))

        template = cursor.fetchone()

        if not template:
            return jsonify({
                "success": False,
                "message": "Template not found."
            }), 404

        image_path = template["image_path"]

        cursor.execute("""
            DELETE FROM user_templates
            WHERE template_id = %s
              AND user_id = %s
        """, (
            template_id,
            user_id
        ))

        connection.commit()

        filename = os.path.basename(image_path)

        file_path = os.path.join(
            app.config["TEMPLATE_UPLOAD_FOLDER"],
            filename
        )

        if os.path.isfile(file_path):
            try:
                os.remove(file_path)
            except OSError:
                app.logger.exception(
                    "Template record deleted, but image file cleanup failed."
                )

        return jsonify({
            "success": True,
            "message": "Template deleted successfully."
        }), 200

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Could not delete template"
        )

        return jsonify({
            "success": False,
            "message": "Could not delete the template."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# =========================
# BLOG COMMENTS
# =========================

# GET COMMENTS FOR A BLOG

@app.route("/blogs/<int:blog_id>/comments", methods=["GET"])
def get_blog_comments(blog_id):

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT blog_id
            FROM blogs
            WHERE blog_id = %s
        """, (blog_id,))

        if not cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Blog not found."
            }), 404

        cursor.execute("""
            SELECT
                c.comment_id,
                c.blog_id,
                c.user_id,
                c.comment,
                c.created_at,
                u.name AS author_name
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.blog_id = %s
            ORDER BY c.created_at DESC, c.comment_id DESC
        """, (blog_id,))

        comments = cursor.fetchall()

        for comment in comments:
            if comment.get("created_at"):
                comment["created_at"] = comment["created_at"].isoformat()

        return jsonify({
            "success": True,
            "comments": comments,
            "count": len(comments)
        }), 200

    except Error:
        app.logger.exception("Could not load blog comments.")

        return jsonify({
            "success": False,
            "message": "Could not load comments."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()


# POST A COMMENT

@app.route("/blogs/<int:blog_id>/comments", methods=["POST"])
@require_auth
def add_blog_comment(blog_id):

    data = get_json_data()
    comment_text = str(data.get("comment") or "").strip()
    user_id = request.authenticated_user_id

    if not comment_text:
        return jsonify({
            "success": False,
            "message": "Please write a comment first."
        }), 400

    if len(comment_text) > 5000:
        return jsonify({
            "success": False,
            "message": "Comment must be 5000 characters or fewer."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT blog_id
            FROM blogs
            WHERE blog_id = %s
        """, (blog_id,))

        if not cursor.fetchone():
            return jsonify({
                "success": False,
                "message": "Blog not found."
            }), 404

        cursor.execute("""
            INSERT INTO comments (blog_id, user_id, comment)
            VALUES (%s, %s, %s)
        """, (blog_id, user_id, comment_text))

        comment_id = cursor.lastrowid
        connection.commit()

        cursor.execute("""
            SELECT
                c.comment_id,
                c.blog_id,
                c.user_id,
                c.comment,
                c.created_at,
                u.name AS author_name
            FROM comments c
            JOIN users u ON c.user_id = u.user_id
            WHERE c.comment_id = %s
        """, (comment_id,))

        new_comment = cursor.fetchone()

        if new_comment and new_comment.get("created_at"):
            new_comment["created_at"] = new_comment["created_at"].isoformat()

        return jsonify({
            "success": True,
            "message": "Comment posted successfully!",
            "comment": new_comment
        }), 201

    except Error:
        if connection:
            connection.rollback()

        app.logger.exception("Could not post blog comment.")

        return jsonify({
            "success": False,
            "message": "Could not post your comment."
        }), 500

    finally:
        if cursor:
            cursor.close()

        if connection and connection.is_connected():
            connection.close()

# =========================
# SERVE TEMPLATE IMAGES
# =========================

@app.route(
    "/uploads/templates/<path:filename>",
    methods=["GET"]
)
def serve_template_image(filename):

    return send_from_directory(
        app.config["TEMPLATE_UPLOAD_FOLDER"],
        filename
    )


# =========================
# FILE SIZE ERROR
# =========================

@app.errorhandler(413)
def request_entity_too_large(error):

    return jsonify({
        "success": False,
        "message": (
            "The uploaded file is too large. "
            "Maximum size is 1.5 MB."
        )
    }), 413


# =========================
# HELP & SUPPORT
# =========================

VALID_SUPPORT_CATEGORIES = {
    "Account and Login",
    "Blog Creation",
    "Search and Recommendations",
    "Profile and Settings",
    "Technical Issue",
    "Other"
}

@app.route("/support", methods=["POST"])
@require_auth
def submit_support_request():

    data = get_json_data()
    user_id = request.authenticated_user_id

    subject = clean_text(data.get("subject"))
    category = clean_text(data.get("category"))
    description = str(data.get("description") or "").strip()

    if not subject:
        return jsonify({
            "success": False,
            "message": "Subject is required."
        }), 400

    if len(subject) < 3 or len(subject) > 200:
        return jsonify({
            "success": False,
            "message": "Subject must be between 3 and 200 characters."
        }), 400

    if not category or category not in VALID_SUPPORT_CATEGORIES:
        return jsonify({
            "success": False,
            "message": "Please select a valid issue category."
        }), 400

    if not description:
        return jsonify({
            "success": False,
            "message": "Description is required."
        }), 400

    if len(description) < 10 or len(description) > 5000:
        return jsonify({
            "success": False,
            "message": "Description must be between 10 and 5000 characters."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            INSERT INTO support_requests (user_id, subject, category, description, status)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            subject,
            category,
            description,
            "Open"
        ))

        new_support_id = cursor.lastrowid
        connection.commit()

        cursor.execute("""
            SELECT support_id, user_id, subject, category, description, status, created_at
            FROM support_requests
            WHERE support_id = %s
        """, (new_support_id,))

        saved_request = cursor.fetchone()
        if saved_request and saved_request.get("created_at"):
            saved_request["created_at"] = saved_request["created_at"].isoformat()

        return jsonify({
            "success": True,
            "message": "Your support request has been submitted successfully.",
            "support_id": new_support_id,
            "request": saved_request
        }), 201

    except Error:
        if connection:
            connection.rollback()
        app.logger.exception("Could not submit support request")
        return jsonify({
            "success": False,
            "message": "Could not submit your support request due to a server error."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/support", methods=["GET"])
@require_auth
def get_user_support_requests():

    user_id = request.authenticated_user_id
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                support_id,
                user_id,
                subject,
                category,
                description,
                status,
                created_at
            FROM support_requests
            WHERE user_id = %s
            ORDER BY created_at DESC, support_id DESC
        """, (user_id,))

        requests_list = cursor.fetchall()

        for req in requests_list:
            if req.get("created_at"):
                req["created_at"] = req["created_at"].isoformat()
            else:
                req["created_at"] = None

        return jsonify({
            "success": True,
            "requests": requests_list,
            "count": len(requests_list)
        }), 200

    except Error:
        app.logger.exception("Could not fetch support requests")
        return jsonify({
            "success": False,
            "message": "Could not load support requests."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# =========================
# GLOBAL LOGOUT ENDPOINT
# =========================

@app.route("/logout", methods=["POST"])
def logout_user():
    # Client will clear tokens from localStorage; server confirms receipt
    return jsonify({
        "success": True,
        "message": "Logged out successfully."
    }), 200




# =========================
# USER IDENTITY & SETTINGS ENDPOINTS
# =========================

@app.route("/me", methods=["GET"])
@require_auth
def get_current_user_profile():
    user_id = request.authenticated_user_id
    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT user_id, name, email, reputation_points
            FROM users
            WHERE user_id = %s
        """, (user_id,))
        user = cursor.fetchone()

        if not user:
            return jsonify({
                "success": False,
                "message": "User not found."
            }), 404

        # Fetch interests
        cursor.execute("""
            SELECT interest
            FROM user_interests
            WHERE user_id = %s
            ORDER BY interest_id ASC
        """, (user_id,))
        interests = [row["interest"] for row in cursor.fetchall()]
        user["interests"] = interests

        return jsonify({
            "success": True,
            "user": user
        }), 200

    except Exception:
        app.logger.exception("Error loading current user profile")
        return jsonify({
            "success": False,
            "message": "Could not load user profile."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/me", methods=["PUT"])
@require_auth
def update_current_user_profile():
    user_id = request.authenticated_user_id
    data = get_json_data()

    name = clean_text(data.get("name"))
    email = clean_text(data.get("email")).lower()

    if not name or len(name) < 2 or len(name) > 100:
        return jsonify({
            "success": False,
            "message": "Full name must be between 2 and 100 characters."
        }), 400

    email_pattern = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
    if not email or not re.match(email_pattern, email):
        return jsonify({
            "success": False,
            "message": "Please enter a valid email address."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        # Check email uniqueness against other users
        cursor.execute("""
            SELECT user_id
            FROM users
            WHERE email = %s AND user_id != %s
        """, (email, user_id))
        existing = cursor.fetchone()

        if existing:
            return jsonify({
                "success": False,
                "message": "This email address is already in use by another account."
            }), 409

        # Update user
        cursor.execute("""
            UPDATE users
            SET name = %s, email = %s
            WHERE user_id = %s
        """, (name, email, user_id))
        connection.commit()

        # Fetch updated user
        cursor.execute("""
            SELECT user_id, name, email, reputation_points
            FROM users
            WHERE user_id = %s
        """, (user_id,))
        updated_user = cursor.fetchone()

        # Fetch interests
        cursor.execute("""
            SELECT interest
            FROM user_interests
            WHERE user_id = %s
            ORDER BY interest_id ASC
        """, (user_id,))
        interests = [row["interest"] for row in cursor.fetchall()]
        updated_user["interests"] = interests

        return jsonify({
            "success": True,
            "message": "Account information updated successfully.",
            "user": updated_user
        }), 200

    except Exception:
        app.logger.exception("Error updating user profile")
        return jsonify({
            "success": False,
            "message": "Could not update account information."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/me/change-password", methods=["POST"])
@require_auth
def change_user_password():
    user_id = request.authenticated_user_id
    data = get_json_data()

    current_password = data.get("current_password") or ""
    new_password = data.get("new_password") or ""
    confirm_password = data.get("confirm_password") or ""

    if not current_password:
        return jsonify({
            "success": False,
            "message": "Current password is required."
        }), 400

    if not new_password or len(new_password) < 8:
        return jsonify({
            "success": False,
            "message": "New password must be at least 8 characters long."
        }), 400

    if new_password != confirm_password:
        return jsonify({
            "success": False,
            "message": "New password and confirmation do not match."
        }), 400

    if current_password == new_password:
        return jsonify({
            "success": False,
            "message": "New password must be different from current password."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT password FROM users WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()

        if not row or not check_password_hash(row["password"], current_password):
            return jsonify({
                "success": False,
                "message": "Current password is incorrect."
            }), 400

        new_hash = generate_password_hash(new_password)
        cursor.execute("UPDATE users SET password = %s WHERE user_id = %s", (new_hash, user_id))
        connection.commit()

        return jsonify({
            "success": True,
            "message": "Password changed successfully."
        }), 200

    except Exception:
        app.logger.exception("Error changing user password")
        return jsonify({
            "success": False,
            "message": "Could not change password."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


@app.route("/me/interests", methods=["GET", "PUT"])
@require_auth
def handle_me_interests():
    user_id = request.authenticated_user_id
    if request.method == "GET":
        return get_interests(user_id)
    else:
        return save_interests(user_id)


@app.route("/me/account", methods=["DELETE"])
@require_auth
def delete_current_user_account():
    user_id = request.authenticated_user_id
    data = get_json_data()
    password = data.get("password") or ""

    if not password:
        return jsonify({
            "success": False,
            "message": "Please enter your password to confirm account deletion."
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        cursor.execute("SELECT password FROM users WHERE user_id = %s", (user_id,))
        row = cursor.fetchone()

        if not row or not check_password_hash(row["password"], password):
            return jsonify({
                "success": False,
                "message": "Password is incorrect. Account deletion cancelled."
            }), 400

        # Safe cascading deletion in transaction
        # 1. Delete answers given by user
        cursor.execute("DELETE FROM answers WHERE user_id = %s", (user_id,))
        # 2. Delete comments given by user
        cursor.execute("DELETE FROM comments WHERE user_id = %s", (user_id,))
        # 3. Delete reading history
        cursor.execute("DELETE FROM reading_history WHERE user_id = %s", (user_id,))
        # 4. Delete support requests
        cursor.execute("DELETE FROM support_requests WHERE user_id = %s", (user_id,))
        # 5. Delete user templates
        cursor.execute("DELETE FROM user_templates WHERE user_id = %s", (user_id,))
        # 6. Delete user interests
        cursor.execute("DELETE FROM user_interests WHERE user_id = %s", (user_id,))
        # 7. For questions by user, delete answers first then questions
        cursor.execute("SELECT question_id FROM questions WHERE user_id = %s", (user_id,))
        user_questions = [r["question_id"] for r in cursor.fetchall()]
        if user_questions:
            format_strings = ','.join(['%s'] * len(user_questions))
            cursor.execute(f"DELETE FROM answers WHERE question_id IN ({format_strings})", tuple(user_questions))
            cursor.execute("DELETE FROM questions WHERE user_id = %s", (user_id,))
        # 8. For blogs by user, delete blog comments/questions then blogs
        cursor.execute("SELECT blog_id FROM blogs WHERE author_id = %s", (user_id,))
        user_blogs = [r["blog_id"] for r in cursor.fetchall()]
        if user_blogs:
            format_strings = ','.join(['%s'] * len(user_blogs))
            cursor.execute(f"DELETE FROM comments WHERE blog_id IN ({format_strings})", tuple(user_blogs))
            cursor.execute(f"DELETE FROM questions WHERE blog_id IN ({format_strings})", tuple(user_blogs))
            cursor.execute(f"DELETE FROM reading_history WHERE blog_id IN ({format_strings})", tuple(user_blogs))
            cursor.execute("DELETE FROM blogs WHERE author_id = %s", (user_id,))
        # 9. Finally delete the user
        cursor.execute("DELETE FROM users WHERE user_id = %s", (user_id,))

        connection.commit()

        return jsonify({
            "success": True,
            "message": "Account deleted successfully."
        }), 200

    except Exception:
        if connection:
            connection.rollback()
        app.logger.exception("Error deleting user account")
        return jsonify({
            "success": False,
            "message": "Could not delete account."
        }), 500

    finally:
        if cursor:
            cursor.close()
        if connection and connection.is_connected():
            connection.close()


# =========================
# RUN APPLICATION
# =========================

if __name__ == "__main__":
    app.run(debug=True)