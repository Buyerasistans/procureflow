import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
import argparse
import yaml

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "tools" / "memory" / "config.json"
FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)

def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

def parse_frontmatter(md_text: str):
    m = FRONTMATTER_RE.match(md_text)
    if not m:
        return None, md_text, "missing frontmatter"
    raw = m.group(1)
    body = md_text[m.end():]
    try:
        data = yaml.safe_load(raw) or {}
    except Exception as exc:
        return None, body, f"yaml parse error: {exc}"
    if not isinstance(data, dict):
        return None, body, "frontmatter is not a mapping"
    return data, body, None

def iter_md_files(paths):
    for p in paths:
        base = ROOT / p
        if not base.exists():
            continue
        for f in base.rglob("*.md"):
            yield f

def parse_date(date_str):
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date(), None
    except Exception:
        return None, "invalid date format (expected YYYY-MM-DD)"

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--strict", action="store_true", help="warnings fail build")
    args = parser.parse_args()

    cfg = load_config()
    req = set(cfg["required_frontmatter_keys"])

    errors = []
    warnings = []

    files = list(iter_md_files(cfg["check_paths"]))
    if not files:
        print("No markdown files found.")
        raise SystemExit(1)

    today_utc = datetime.now(timezone.utc).date()

    for f in files:
        rel = f.relative_to(ROOT).as_posix()
        text = f.read_text(encoding="utf-8", errors="ignore")
        fm, body, fm_err = parse_frontmatter(text)

        if fm_err:
            errors.append(f"{rel}: {fm_err}")
            continue

        missing = req - set(fm.keys())
        if missing:
            errors.append(f"{rel}: missing frontmatter keys: {sorted(missing)}")

        # confidence
        conf = fm.get("confidence")
        try:
            c = float(conf)
            if not (0.0 <= c <= 1.0):
                errors.append(f"{rel}: confidence must be between 0 and 1")
            elif c < 0.60:
                warnings.append(f"{rel}: low confidence ({c})")
        except Exception:
            errors.append(f"{rel}: invalid confidence value")

        # stale_after_days
        sad = fm.get("stale_after_days")
        sad_int = None
        try:
            sad_int = int(sad)
            if sad_int <= 0:
                errors.append(f"{rel}: stale_after_days must be > 0")
        except Exception:
            errors.append(f"{rel}: invalid stale_after_days value")

        # last_verified_at
        lva = fm.get("last_verified_at")
        dt, err = parse_date(str(lva))
        if err:
            errors.append(f"{rel}: {err}")
        elif sad_int is not None:
            expire = dt + timedelta(days=sad_int)
            if today_utc > expire:
                warnings.append(f"{rel}: stale page (expired {expire})")

        # source_files
        sf = fm.get("source_files")
        if not isinstance(sf, list) or not sf:
            errors.append(f"{rel}: source_files must be a non-empty list")
        else:
            for s in sf:
                sp = (ROOT / str(s)).resolve()
                if not sp.exists():
                    warnings.append(f"{rel}: source file not found -> {s}")

        # optional simple wiki link checks
        links = re.findall(r"\[\[([^\]]+)\]\]", body)
        for lk in links:
            if "/" in lk and not (ROOT / lk).exists():
                warnings.append(f"{rel}: possible broken wiki link [[{lk}]]")

    print("=== Wiki Lint Report ===")
    print(f"Files checked : {len(files)}")
    print(f"Errors        : {len(errors)}")
    print(f"Warnings      : {len(warnings)}")

    if errors:
        print("\n-- Errors --")
        for e in errors:
            print(f"- {e}")

    if warnings:
        print("\n-- Warnings --")
        for w in warnings:
            print(f"- {w}")

    if errors or (args.strict and warnings):
        raise SystemExit(1)

if __name__ == "__main__":
    main()
