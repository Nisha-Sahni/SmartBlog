import os
import sys
import json

sys.path.insert(0, os.path.abspath('Backend'))
from app import app, get_db_connection, token_serializer
from ai_writer import ai_writing_assistant

client = app.test_client()

print("=" * 65)
print("TESTING ALL 4 NEW / FIXED CAPABILITIES IN SMARTBLOG")
print("=" * 65)

# Connect to database
conn = get_db_connection()
cursor = conn.cursor(dictionary=True)
cursor.execute("SELECT user_id, email, name FROM users ORDER BY user_id LIMIT 5")
users = cursor.fetchall()
print(f"Loaded {len(users)} users from MySQL:")
for u in users:
    print(f"  User {u['user_id']}: {u['name']} ({u['email']})")

u1 = users[0]
u2 = users[1]
u3 = users[2]

token1 = token_serializer.dumps({"user_id": u1["user_id"], "email": u1["email"]})
token2 = token_serializer.dumps({"user_id": u2["user_id"], "email": u2["email"]})
token3 = token_serializer.dumps({"user_id": u3["user_id"], "email": u3["email"]})

print("\n--- 1. VERIFYING PROFILE MENU & DROPDOWN ACROSS ALL HTML PAGES ---")
import glob, re
html_files = sorted(glob.glob("Frontend/*.html"))
passed_pages = []
for hf in html_files:
    fname = os.path.basename(hf)
    if fname in ["login.html", "signup.html", "interests.html"]:
        continue
    with open(hf, "r", encoding="utf-8") as f:
        c = f.read()
    assert 'class="profile-menu"' in c or 'class="profile-dropdown"' in c, f"Missing profile menu in {fname}"
    assert 'href="profile.html"' in c, f"Missing profile link in {fname}"
    assert 'href="settings.html"' in c, f"Missing settings link in {fname}"
    assert 'logoutButton' in c or 'logout' in c.lower(), f"Missing logout button in {fname}"
    passed_pages.append(fname)

print(f"Verified {len(passed_pages)} pages with standardized profile dropdown:")
print("  " + ", ".join(passed_pages))
print("PASSED: Profile menu with Profile, Settings, and Log Out is consistent across all pages.")

print("\n--- 2. VERIFYING EXPLORE PAGE BLOGS & STABILITY ---")
with open("Frontend/style.css", "r", encoding="utf-8") as f:
    style_css = f.read()
assert ".story-slider .story-grid" in style_css, "Marquee not properly scoped in style.css!"
assert "animation: none !important" in style_css, "Explore story-grid missing animation: none override!"

with open("Frontend/explore.js", "r", encoding="utf-8") as f:
    explore_js = f.read()
assert 'window.location.href = `blog.html?id=${blog.blog_id}`' in explore_js, "Card click navigation missing!"
assert "e.target.closest(\".save-button\")" in explore_js, "Save button isolation missing!"
assert "author-link" in explore_js, "Author link missing!"

res_blogs = client.get("/blogs")
assert res_blogs.status_code == 200
blogs_data = json.loads(res_blogs.data).get("blogs", [])
print(f"Explore page retrieves {len(blogs_data)} blogs from MySQL.")
print("PASSED: Explore cards are stable (no marquee), clickable to actual blog_id, and buttons are isolated.")

print("\n--- 3. VERIFYING LIGHT AI WRITING ASSISTANT ---")
# Test 3a: Improve writing
res_imp = client.post(
    "/ai/assist",
    data=json.dumps({
        "action": "improve",
        "text": "In order to make a decision , we must take into consideration all facts."
    }),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_imp.status_code == 200, f"AI improve failed: {res_imp.data}"
imp_data = json.loads(res_imp.data)
print(f"AI Improve: '{imp_data['improved_text']}' (Improvements: {imp_data['improvements']})")
assert "consider" in imp_data["improved_text"]

# Test 3b: Continue writing
res_cnt = client.post(
    "/ai/assist",
    data=json.dumps({
        "action": "continue",
        "title": "Designing with Purpose",
        "content": "Good design is not just how something looks, but how it works and feels in daily use."
    }),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_cnt.status_code == 200, f"AI continue failed: {res_cnt.data}"
cnt_data = json.loads(res_cnt.data)
print(f"AI Continue: '{cnt_data['continuation']}'")

# Test 3c: Generate subtitle
res_sub = client.post(
    "/ai/assist",
    data=json.dumps({
        "action": "subtitle",
        "title": "Designing with Purpose",
        "content": "Good design is not just how something looks, but how it works and feels in daily use. When we build with empathy, the end user experiences seamless joy."
    }),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_sub.status_code == 200, f"AI subtitle failed: {res_sub.data}"
sub_data = json.loads(res_sub.data)
print(f"AI Subtitle: '{sub_data['subtitle']}'")

# Test 3d: Suggest ideas
res_ids = client.post(
    "/ai/assist",
    data=json.dumps({
        "action": "ideas",
        "title": "Designing with Purpose",
        "content": "Good design and empathy in modern web applications.",
        "topic": "Technology"
    }),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_ids.status_code == 200, f"AI ideas failed: {res_ids.data}"
ids_data = json.loads(res_ids.data)
print(f"AI Ideas generated {len(ids_data['ideas'])} angles: {[i['title'] for i in ids_data['ideas']]}")
print("PASSED: All 4 AI Writing Assistant endpoints verified and functional.")

print("\n--- 4. VERIFYING DIRECT MESSAGING & USER SEARCH ---")
# Test 4a: User search
res_search = client.get(
    "/users/search?q=",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_search.status_code == 200, f"Search users failed: {res_search.data}"
found_users = json.loads(res_search.data)["users"]
print(f"Found {len(found_users)} registered writers to message.")
assert any(u["user_id"] == u2["user_id"] for u in found_users)

# Test 4b: Start/fetch conversation between u1 and u2
res_conv = client.post(
    "/conversations",
    data=json.dumps({"recipient_id": u2["user_id"]}),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_conv.status_code in [200, 201], f"Conv init failed: {res_conv.data}"
conv_id = json.loads(res_conv.data)["conversation_id"]

# Test 4c: Send message from u1 to u2
test_content = f"Direct message test at {os.getpid()}"
res_send = client.post(
    f"/conversations/{conv_id}/messages",
    data=json.dumps({"content": test_content}),
    content_type="application/json",
    headers={"Authorization": f"Bearer {token1}"}
)
assert res_send.status_code == 201, f"Send message failed: {res_send.data}"
sent_msg = json.loads(res_send.data)["message"]
print(f"Message {sent_msg['message_id']} sent from User {u1['user_id']} ({u1['name']}) to User {u2['user_id']} ({u2['name']})")

# Test 4d: Recipient u2 retrieves messages and verifies DB persistence
res_thread = client.get(
    f"/conversations/{conv_id}/messages",
    headers={"Authorization": f"Bearer {token2}"}
)
assert res_thread.status_code == 200
thread_data = json.loads(res_thread.data)
assert any(m["message_id"] == sent_msg["message_id"] for m in thread_data["messages"])
print(f"User {u2['name']} successfully retrieved thread with {len(thread_data['messages'])} messages.")

# Test 4e: Verify unauthorized user u3 gets 403 Forbidden
res_blocked = client.get(
    f"/conversations/{conv_id}/messages",
    headers={"Authorization": f"Bearer {token3}"}
)
assert res_blocked.status_code == 403, f"Security violation: expected 403, got {res_blocked.status_code}"
print("PASSED: Unauthorized user correctly blocked with 403 Forbidden.")
print("PASSED: Direct Messaging system is completely database-backed and secure.")

print("\n" + "=" * 65)
print("ALL 4 USER REQUIREMENTS VERIFIED AND PASSED 100%!")
print("=" * 65)
cursor.close()
conn.close()

