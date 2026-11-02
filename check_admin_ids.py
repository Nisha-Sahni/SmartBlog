import re

with open('Frontend/admin.js', 'r', encoding='utf-8') as f:
    js_code = f.read()

with open('Frontend/admin.html', 'r', encoding='utf-8') as f:
    html_code = f.read()

js_ids = set(re.findall(r'getElementById\(["\']([^"\']+)["\']\)', js_code))
html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_code))

missing = js_ids - html_ids
print('IDs in JS but missing in HTML:', missing)
print('Total JS IDs matched:', len(js_ids - missing), '/', len(js_ids))

