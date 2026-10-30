
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

app.config["SECRET_KEY"] = os.getenv("SMARTBLOG_SECRET_KEY")

if not app.config["SECRET_KEY"]:
    raise RuntimeError(
        "SMARTBLOG_SECRET_KEY is not configured."
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
        return mysql.connector.connect(
            host=os.getenv("SMARTBLOG_DB_HOST", "localhost"),
            user=os.getenv("SMARTBLOG_DB_USER", "root"),
            password=os.getenv("SMARTBLOG_DB_PASSWORD"),
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

            blog["content"] = clean_text(
                blog.get("content")
            )

            blog["author_name"] = (
                clean_text(blog.get("author_name"))
                or "SmartBlog writer"
            )

            if blog.get("created_at"):
                blog["created_at"] = (
                    blog["created_at"].isoformat()
                )
            else:
                blog["created_at"] = None

            blog["excerpt"] = blog["content"][:220]

        cursor.close()

        return blogs

    finally:
        connection.close()


# =========================
# TF-IDF SEMANTIC SEARCH
# =========================

def find_search_results(query, blogs):

    query = clean_text(query)

    if not blogs:
        return []

    if not query:
        return blogs

    documents = [
        f"{blog.get('title', '')} {blog.get('content', '')}"
        for blog in blogs
    ]

    if not any(document.strip() for document in documents):
        return []

    try:
        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True
        )

        document_vectors = vectorizer.fit_transform(
            documents
        )

        query_vector = vectorizer.transform([
            query
        ])

        scores = cosine_similarity(
            query_vector,
            document_vectors
        ).flatten()

    except ValueError:
        return []

    results = []

    for blog, score in zip(blogs, scores):

        if score > 0:

            result = dict(blog)

            result["relevance_score"] = round(
                float(score),
                4
            )

            results.append(result)

    results.sort(
        key=lambda blog: (
            blog["relevance_score"],
            blog.get("created_at") or ""
        ),
        reverse=True
    )

    return results


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

    except Error:

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
            "message": "All fields are required."
        }), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({
            "message": (
                "Password must contain at least "
                "8 characters."
            )
        }), 400

    hashed_password = generate_password_hash(
        password
    )

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

        connection.commit()

        return jsonify({
            "message": "Account created successfully!"
        }), 201

    except IntegrityError:

        if connection:
            connection.rollback()

        return jsonify({
            "message": (
                "An account with this email "
                "may already exist."
            )
        }), 409

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Signup database error"
        )

        return jsonify({
            "message": "Could not create your account."
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
def create_blog():

    data = get_json_data()

    title = clean_text(
        data.get("title")
    )

    content = clean_text(
        data.get("content")
    )

    author_id = data.get("author_id")

    if not title or not content or author_id is None:
        return jsonify({
            "message": (
                "Title, content, and author_id are required."
            )
        }), 400

    if len(title) > 200:
        return jsonify({
            "message": (
                "Title must be 200 characters or fewer."
            )
        }), 400

    try:
        author_id = int(author_id)

        if author_id <= 0:
            raise ValueError

    except (ValueError, TypeError):

        return jsonify({
            "message": (
                "author_id must be a valid positive integer."
            )
        }), 400

    connection = None
    cursor = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        cursor.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (author_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "message": "Author account not found."
            }), 404

        cursor.execute("""
            INSERT INTO blogs
                (title, content, author_id)
            VALUES (%s, %s, %s)
        """, (
            title,
            content,
            author_id
        ))

        connection.commit()

        new_blog_id = cursor.lastrowid

        return jsonify({
            "message": "Blog published successfully!",
            "blog_id": new_blog_id,
            "title": title
        }), 201

    except Error:

        if connection:
            connection.rollback()

        app.logger.exception(
            "Could not publish blog"
        )

        return jsonify({
            "message": "Could not publish the blog."
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

    if len(query) > 300:
        return jsonify({
            "message": "Search query is too long."
        }), 400

    try:
        blogs = fetch_blogs()

        if not query:
            return jsonify({
                "query": "",
                "method": "tfidf",
                "results": blogs,
                "count": len(blogs)
            }), 200

        results = find_search_results(
            query,
            blogs
        )

        return jsonify({
            "query": query,
            "method": "tfidf_cosine_similarity",
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

    # Check actual uploaded size.
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

    # Validate image contents rather than trusting filename.
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

    # Generate a unique filename.
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

        # Delete image file after successful DB deletion.
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
# SERVE TEMPLATE IMAGES
# =========================

@app.route(
    "/uploads/templates/<path:filename>",
    methods=["GET"]
)
def serve_template_image(filename):

    # Filenames are generated by the backend,
    # not supplied as arbitrary filesystem paths.
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
# RUN APPLICATION
# =========================

if __name__ == "__main__":
    app.run(debug=True)
