import re

file_path = r"d:\Projects\procureflow\api\main.py"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# Find and replace the migrations list
old_line = '            "ALTER TABLE companies ADD COLUMN logo_url VARCHAR(500)",'
new_lines = """            "ALTER TABLE companies ADD COLUMN logo_url VARCHAR(500)",
            "ALTER TABLE companies ADD COLUMN tax_office VARCHAR(255)",
            "ALTER TABLE companies ADD COLUMN address VARCHAR(500)",
            "ALTER TABLE companies ADD COLUMN phone VARCHAR(20)",
            "ALTER TABLE companies ADD COLUMN contact_info VARCHAR(500)",
            "ALTER TABLE companies ADD COLUMN hide_location BOOLEAN DEFAULT 0 NOT NULL",
            "ALTER TABLE companies ADD COLUMN share_on_whatsapp BOOLEAN DEFAULT 1 NOT NULL","""

content = content.replace(old_line, new_lines)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("✅ Updated main.py with new company columns")
