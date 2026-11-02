import re

with open("Frontend/create-blog.html", "r", encoding="utf-8") as f:
    c = f.read()

templates_html = re.findall(r'data-template="([^"]+)"', c)
print("Templates in create-blog.html:", templates_html)

