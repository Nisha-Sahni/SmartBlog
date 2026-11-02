import sys
sys.path.append('Backend')
from app import app, get_db_connection
from werkzeug.security import generate_password_hash

client = app.test_client()

# 1. GET /admin/login
res = client.get('/admin/login')
assert res.status_code == 200, f"GET /admin/login failed: {res.status_code}"
assert 'Admin Login' in res.get_data(as_text=True)
print("[PASS] GET /admin/login returns 200 with admin login page")

# 2. GET /admin and /admin/dashboard
res = client.get('/admin')
assert res.status_code == 200, f"GET /admin failed: {res.status_code}"
assert 'SmartBlog Admin' in res.get_data(as_text=True)
print("[PASS] GET /admin returns 200 with admin dashboard page")

# 3. GET static assets via /admin/<filename>
for asset in ['admin.css', 'admin.js', 'admin-login.js']:
    res = client.get(f'/admin/{asset}')
    assert res.status_code == 200, f"GET /admin/{asset} failed: {res.status_code}"
print("[PASS] Static assets load cleanly via /admin/<asset>")

# 4. POST /admin/login with invalid credentials
res = client.post('/admin/login', json={'email': 'admin@smartblog.com', 'password': 'wrongpassword'}, content_type='application/json')
assert res.status_code == 401, f"Expected 401, got {res.status_code}"
print("[PASS] POST /admin/login invalid password returns 401")

# 5. POST /admin/login with non-existent email
res = client.post('/admin/login', json={'email': 'nobody@smartblog.com', 'password': 'password'}, content_type='application/json')
assert res.status_code == 401, f"Expected 401, got {res.status_code}"
print("[PASS] POST /admin/login non-existent email returns 401")

# 6. POST /admin/login with valid admin credentials
res = client.post('/admin/login', json={'email': 'admin@smartblog.com', 'password': 'admin123456'}, content_type='application/json')
assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.get_data(as_text=True)}"
data = res.get_json()
assert data.get('success') is True
assert 'token' in data
assert data['user']['is_admin'] == 1
print("[PASS] POST /admin/login with valid admin credentials returns 200 and auth token")

# 7. Test non-admin user login on /admin/login
conn = get_db_connection()
cur = conn.cursor(dictionary=True)
test_non_admin_email = "test_normal_user@smartblog.com"
test_pw = "normal123456"
cur.execute("SELECT user_id FROM users WHERE email = %s", (test_non_admin_email,))
u = cur.fetchone()
if not u:
    cur.execute(
        "INSERT INTO users (name, email, password, is_admin, status) VALUES (%s, %s, %s, 0, 'active')",
        ("Normal User", test_non_admin_email, generate_password_hash(test_pw))
    )
    conn.commit()
else:
    cur.execute(
        "UPDATE users SET password = %s, is_admin = 0, status = 'active' WHERE email = %s",
        (generate_password_hash(test_pw), test_non_admin_email)
    )
    conn.commit()
cur.close()
conn.close()

res = client.post('/admin/login', json={'email': test_non_admin_email, 'password': test_pw}, content_type='application/json')
assert res.status_code == 403, f"Expected 403 Forbidden for non-admin, got {res.status_code}"
non_admin_data = res.get_json()
assert "administrator" in non_admin_data.get('message', '').lower()
print("[PASS] POST /admin/login with non-admin credentials returns 403 Forbidden with proper error message")

# 8. Check bootstrap route when admin exists
res = client.post('/api/admin/setup-first-admin', json={'name': 'Hacker', 'email': 'hacker@test.com', 'password': '123'}, content_type='application/json')
assert res.status_code == 403, f"Expected 403 when admin exists, got {res.status_code}"
print("[PASS] POST /api/admin/setup-first-admin returns 403 when admin already exists")

# 9. Verify normal user login succeeds on POST /login for non-admin user
res = client.post('/login', json={'email': test_non_admin_email, 'password': test_pw}, content_type='application/json')
assert res.status_code == 200, f"Expected 200 on /login, got {res.status_code}"
user_data = res.get_json()
assert 'token' in user_data or user_data.get('status') == 'success' or 'user' in user_data
print("[PASS] Normal user login POST /login succeeds without interference")

print("\n==========================================")
print("ALL ADMIN AUTHENTICATION TESTS PASSED 100%")
print("==========================================")
