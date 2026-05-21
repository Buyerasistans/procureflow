from pathlib import Path
from datetime import datetime
import re

ROOT = Path(__file__).resolve().parents[2]

DOMAIN_FILES = [
    "wiki/domains/admin-governance.md",
    "wiki/domains/auth-permission.md",
    "wiki/domains/onboarding-saas.md",
    "wiki/domains/payment-billing.md",
    "wiki/domains/public-content-seo.md",
    "wiki/domains/quote-approval.md",
    "wiki/domains/supplier-portal.md",
]

DATE_RE = re.compile(r"^(last_verified_at:\s*)(\d{4}-\d{2}-\d{2})\s*$", re.MULTILINE)

def main():
    today = datetime.now().strftime("%Y-%m-%d")
    for rel in DOMAIN_FILES:
        p = ROOT / rel
        if not p.exists():
            print(f"SKIP (not found): {rel}")
            continue
        text = p.read_text(encoding="utf-8")
        new_text, n = DATE_RE.subn(rf"\g<1>{today}", text)
        if n == 0:
            print(f"WARN (no last_verified_at): {rel}")
            continue
        p.write_text(new_text, encoding="utf-8")
        print(f"UPDATED: {rel}")
    print("Done.")

if __name__ == "__main__":
    main()
