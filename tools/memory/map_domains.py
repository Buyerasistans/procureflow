import json
import subprocess
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[2]
CONFIG_PATH = ROOT / "tools" / "memory" / "config.json"

def load_config():
    return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

def get_changed_files(base_ref: str = "origin/main"):
    cmd = ["git", "diff", "--name-only", f"{base_ref}...HEAD"]
    out = subprocess.check_output(cmd, cwd=ROOT, text=True, encoding="utf-8")
    return [line.strip().replace("\\", "/") for line in out.splitlines() if line.strip()]

def match_domains(changed_files, rules):
    touched = {}
    for f in changed_files:
        for rule in rules:
            if any(pat in f for pat in rule["patterns"]):
                touched.setdefault(rule["name"], set()).add(f)
    return touched

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", default="origin/main")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    cfg = load_config()
    changed = get_changed_files(args.base_ref)
    touched = match_domains(changed, cfg["domain_rules"])

    result = {
        "changed_files": changed,
        "touched_domains": {k: sorted(list(v)) for k, v in touched.items()},
        "required_wiki_files": [
            r["wiki_file"] for r in cfg["domain_rules"] if r["name"] in touched
        ],
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print("Changed files:")
        for f in changed:
            print(f"  - {f}")
        print("\nTouched domains:")
        if not touched:
            print("  (none)")
        for d, files in result["touched_domains"].items():
            print(f"  - {d}")
            for f in files:
                print(f"    - {f}")
        print("\nRequired wiki files:")
        for wf in result["required_wiki_files"]:
            print(f"  - {wf}")

if __name__ == "__main__":
    main()
