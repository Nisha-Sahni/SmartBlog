from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.security import generate_password_hash, check_password_hash
import mysql.connector

app = Flask(__name__)
CORS(app)

# MySQL connection
db = mysql.connector.connect(
    host="localhost",
    user="root",
    password="nishasahni@2626",
    database="smartblog"
)

@app.route("/")
def home():
    return "SmartBlog Backend is running!"


@app.route("/db-test")
def db_test():
    if db.is_connected():
        return "MySQL connection successful!"
    return "MySQL connection failed!"


@app.route("/signup", methods=["POST"])
def signup():

    data = request.get_json()

    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not name or not email or not password:
        return jsonify({
            "message": "All fields are required."
        }), 400

    hashed_password = generate_password_hash(password)

    cursor = db.cursor()

    query = """
        INSERT INTO users (name, email, password)
        VALUES (%s, %s, %s)
    """

    cursor.execute(query, (name, email, hashed_password))
    db.commit()

    cursor.close()

    return jsonify({
        "message": "Account created successfully!"
    }), 201

@app.route("/login", methods=["POST"])
def login():

    data = request.get_json()

    email = data.get("email")
    password = data.get("password")

    if not email or not password:
        return jsonify({
            "message": "Email and password are required."
        }), 400

    cursor = db.cursor()

    query = """
        SELECT user_id, name, email, password
        FROM users
        WHERE email = %s
    """

    cursor.execute(query, (email,))
    user = cursor.fetchone()

    cursor.close()

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

if __name__ == "__main__":
    app.run(debug=True)