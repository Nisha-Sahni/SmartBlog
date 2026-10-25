
import os
import re

from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector
from mysql.connector import IntegrityError, Error

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


app = Flask(__name__)
CORS(app)


# --------------------------------------------------
# DATABASE CONNECTION
# Set SMARTBLOG_DB_PASSWORD in your environment first.
# --------------------------------------------------

def get_db_connection():
    try:
        return mysql.connector.connect(
            host=os.getenv("SMARTBLOG_DB_HOST", "localhost"),
            user=os.getenv("SMARTBLOG_DB_USER", "root"),
            password=os.getenv("SMARTBLOG_DB_PASSWORD"),
            database=os.getenv("SMARTBLOG_DB_NAME", "smartblog")
        )
    except mysql.connector.Error as e:
        app.logger.error("MySQL connection failed: %s", e)
        raise

# --------------------------------------------------
# HELPER FUNCTIONS
# --------------------------------------------------

def get_json_data():
    return request.get_json(silent=True) or {}


def clean_text(value):
    """Convert a value into safe, normalized text."""
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def fetch_blogs():
    """Fetch blogs and author names from MySQL."""
    connection = get_db_connection()

    try:
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                b.blog_id,
                b.title,
                b.content,
                b.author_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u ON b.author_id = u.user_id
            ORDER BY b.created_at DESC, b.blog_id DESC
        """

        cursor.execute(query)
        blogs = cursor.fetchall()

        for blog in blogs:
            blog["title"] = clean_text(blog.get("title"))
            blog["content"] = clean_text(blog.get("content"))
            blog["author_name"] = (
                clean_text(blog.get("author_name")) or "SmartBlog writer"
            )

            if blog.get("created_at"):
                blog["created_at"] = blog["created_at"].isoformat()
            else:
                blog["created_at"] = None

            # Temporary excerpt for displaying search results.
            blog["excerpt"] = blog["content"][:220]

        return blogs

    finally:
        connection.close()


def find_search_results(query, blogs):
    """
    Rank blogs using TF-IDF and cosine similarity.

    This is text-similarity search, not a full semantic
    embedding model.
    """
    query = clean_text(query)

    if not blogs:
        return []

    if not query:
        return blogs

    documents = [
        f"{blog.get('title', '')} {blog.get('content', '')}"
        for blog in blogs
    ]

    # Handle an empty or whitespace-only corpus.
    if not any(document.strip() for document in documents):
        return []

    try:
        vectorizer = TfidfVectorizer(
            lowercase=True,
            stop_words="english",
            ngram_range=(1, 2),
            sublinear_tf=True
        )

        document_vectors = vectorizer.fit_transform(documents)
        query_vector = vectorizer.transform([query])

        # If none of the query's words exist in the vocabulary,
        # cosine similarity will be zero for every blog.
        scores = cosine_similarity(
            query_vector, document_vectors
        ).flatten()

    except ValueError:
        # For example, if every document contains only stop words.
        return []

    results = []

    for blog, score in zip(blogs, scores):
        if score > 0:
            result = dict(blog)
            result["relevance_score"] = round(float(score), 4)
            results.append(result)

    results.sort(
        key=lambda blog: (
            blog["relevance_score"],
            blog.get("created_at") or ""
        ),
        reverse=True
    )

    return results


# --------------------------------------------------
# HOME AND DATABASE TEST
# --------------------------------------------------

@app.route("/", methods=["GET"])
def home():
    return "SmartBlog Backend is running!"


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

    except Error as error:
        app.logger.error("Database test failed: %s", error)

        return jsonify({
            "message": "Could not connect to MySQL. Check your configuration."
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# SIGNUP
# --------------------------------------------------

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
            "message": "Password must contain at least 8 characters."
        }), 400

    hashed_password = generate_password_hash(password)
    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            INSERT INTO users (name, email, password)
            VALUES (%s, %s, %s)
        """

        cursor.execute(query, (name, email, hashed_password))
        connection.commit()

        return jsonify({
            "message": "Account created successfully!"
        }), 201

    except IntegrityError:
        if connection:
            connection.rollback()

        return jsonify({
            "message": "An account with this email may already exist."
        }), 409

    except Error:
        if connection:
            connection.rollback()

        app.logger.exception("Signup database error")

        return jsonify({
            "message": "Could not create your account."
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# LOGIN
# --------------------------------------------------

@app.route("/login", methods=["POST"])
def login():
    data = get_json_data()

    email = clean_text(data.get("email")).lower()
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "message": "Email and password are required."
        }), 400

    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        query = """
            SELECT user_id, name, email, password
            FROM users
            WHERE email = %s
        """

        cursor.execute(query, (email,))
        user = cursor.fetchone()

        if user and check_password_hash(user[3], password):
            return jsonify({
                "message": "Login successful!",
                "user_id": user[0],
                "name": user[1],
                "email": user[2]
            }), 200

        return jsonify({
            "message": "Invalid email or password."
        }), 401

    except Error:
        app.logger.exception("Login database error")

        return jsonify({
            "message": "Could not complete login."
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# GET ALL BLOGS
# GET /blogs
# --------------------------------------------------

@app.route("/blogs", methods=["GET"])
def get_blogs():
    try:
        blogs = fetch_blogs()

        return jsonify({
            "blogs": blogs,
            "count": len(blogs)
        }), 200

    except Error:
        app.logger.exception("Could not retrieve blogs")

        return jsonify({
            "message": "Could not retrieve blogs."
        }), 500


# --------------------------------------------------
# GET ONE BLOG
# GET /blogs/1
# --------------------------------------------------

@app.route("/blogs/<int:blog_id>", methods=["GET"])
def get_blog(blog_id):
    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor(dictionary=True)

        query = """
            SELECT
                b.blog_id,
                b.title,
                b.content,
                b.author_id,
                b.created_at,
                u.name AS author_name
            FROM blogs b
            LEFT JOIN users u ON b.author_id = u.user_id
            WHERE b.blog_id = %s
        """

        cursor.execute(query, (blog_id,))
        blog = cursor.fetchone()

        if not blog:
            return jsonify({
                "message": "Blog not found."
            }), 404

        blog["author_name"] = (
            clean_text(blog.get("author_name")) or "SmartBlog writer"
        )
        blog["excerpt"] = clean_text(blog.get("content"))[:220]

        if blog.get("created_at"):
            blog["created_at"] = blog["created_at"].isoformat()

        return jsonify({"blog": blog}), 200

    except Error:
        app.logger.exception("Could not retrieve blog")

        return jsonify({
            "message": "Could not retrieve blog."
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# CREATE A BLOG
# POST /blogs
#
# Expected JSON:
# {
#   "title": "My first blog",
#   "content": "The full blog content...",
#   "author_id": 1
# }
# --------------------------------------------------

@app.route("/blogs", methods=["POST"])
def create_blog():
    data = get_json_data()

    title = clean_text(data.get("title"))
    content = clean_text(data.get("content"))
    author_id = data.get("author_id")

    if not title or not content or author_id is None:
        return jsonify({
            "message": "Title, content, and author_id are required."
        }), 400

    if len(title) > 200:
        return jsonify({
            "message": "Title must be 200 characters or fewer."
        }), 400

    try:
        author_id = int(author_id)

        if author_id <= 0:
            raise ValueError

    except (ValueError, TypeError):
        return jsonify({
            "message": "author_id must be a valid positive integer."
        }), 400

    connection = None

    try:
        connection = get_db_connection()
        cursor = connection.cursor()

        # Confirm the author exists.
        cursor.execute(
            "SELECT user_id FROM users WHERE user_id = %s",
            (author_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({
                "message": "Author account not found."
            }), 404

        query = """
            INSERT INTO blogs (title, content, author_id)
            VALUES (%s, %s, %s)
        """

        cursor.execute(query, (title, content, author_id))
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

        app.logger.exception("Could not publish blog")

        return jsonify({
            "message": "Could not publish the blog."
        }), 500

    finally:
        if connection and connection.is_connected():
            connection.close()


# --------------------------------------------------
# NLP SEARCH
# GET /search?q=how+do+I+start+DSA
# --------------------------------------------------

@app.route("/search", methods=["GET"])
def search_blogs():
    query = clean_text(request.args.get("q", ""))

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

        results = find_search_results(query, blogs)

        return jsonify({
            "query": query,
            "method": "tfidf_cosine_similarity",
            "results": results,
            "count": len(results)
        }), 200

    except Error:
        app.logger.exception("Search database error")

        return jsonify({
            "message": "Could not search blogs."
        }), 500


if __name__ == "__main__":
    app.run(debug=True)
