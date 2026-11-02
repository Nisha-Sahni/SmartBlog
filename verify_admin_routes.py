import sys
sys.path.append('Backend')
from app import app

client = app.test_client()

routes_to_test = [
    '/admin',
    '/admin/',
    '/admin/dashboard',
    '/admin.css',
    '/admin.js',
    '/admin/admin.css',
    '/admin/admin.js',
    '/dashboard.html',
    '/blog.html'
]

print("--- Testing Route Availability ---")
for r in routes_to_test:
    res = client.get(r)
    print(f'{r:20} -> {res.status_code} (length: {len(res.get_data())})')
    assert res.status_code == 200, f'Failed route {r}'

print('\nALL ADMIN HTTP ROUTES RETURN 200 OK!')

