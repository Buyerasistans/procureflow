import json
import re
import subprocess
from pathlib import Path
from git_base import detect_base_ref

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "tools" / "memory" / "config.json"
API_MAIN = ROOT / "api" / "main.py"

ROUTER_IMPORT_RE = re.compile(r"from\s+\.routers\.(\w+)\s+import\s+router\s+as\s+(\w+)")
INCLUDE_RE = re.compile(r"app\.include_router\((\w+)")

def git_changed(base_ref="origin/main"):
    out = subprocess.check_output(
        ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
        cwd=ROOT, text=True, encoding="utf-8"
    )
    return [x.strip().replace("\\", "/") for x in out.splitlines() if x.strip()]

def parse_api_main():
    if not API_MAIN.exists():
        return {}
    text = API_MAIN.read_text(encoding="utf-8", errors="ignore")
    alias_to_router = {}
    for m in ROUTER_IMPORT_RE.finditer(text):
        router_module, alias = m.groups()
        alias_to_router[alias] = f"api/routers/{router_module}.py"

    included = []
    for m in INCLUDE_RE.finditer(text):
        alias = m.group(1)
        if alias in alias_to_router:
            included.append(alias_to_router[alias])
    return {"included_router_files": sorted(set(included))}

def map_domains(changed_files, rules):
    touched = set()
    for f in changed_files:
        for r in rules:
            if any(p in f for p in r["patterns"]):
                touched.add(r["name"])
    return touched

def updated_wiki_files(changed_files):
    return {f for f in changed_files if f.startswith("wiki/domains/") and f.endswith(".md")}

def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))

    base_ref = detect_base_ref()
    changed = git_changed(base_ref)
    print(f"base_ref             : {base_ref}")

    touched_domains = map_domains(changed, cfg["domain_rules"])
    changed_wiki = updated_wiki_files(changed)

    required_wiki = {
        r["wiki_file"] for r in cfg["domain_rules"] if r["name"] in touched_domains
    }

    updated_required_count = len(required_wiki.intersection(changed_wiki))
    changed_domain_count = len(touched_domains)
    coverage = 1.0 if changed_domain_count == 0 else (updated_required_count / changed_domain_count)

    route_info = parse_api_main()

    print("=== Domain Coverage Report ===")
    print(f"changed_domain_count : {changed_domain_count}")
    print(f"updated_required_wiki: {updated_required_count}")
    print(f"coverage_score       : {coverage:.2f}")
    print("\nTouched domains:")
    for d in sorted(touched_domains):
        print(f"- {d}")
    print("\nRequired wiki files:")
    for w in sorted(required_wiki):
        print(f"- {w}")
    print("\nChanged wiki domain files:")
    for w in sorted(changed_wiki):
        print(f"- {w}")

    if route_info.get("included_router_files"):
        print("\napi/main.py included routers:")
        for r in route_info["included_router_files"]:
            print(f"- {r}")

    rollout = cfg.get("rollout", {})
    mode = rollout.get("mode", "strict")
    strict_min = float(rollout.get("strict_min_coverage", 1.00))
    bootstrap_min = float(rollout.get("bootstrap_min_coverage", 0.20))
    min_cov = bootstrap_min if mode == "bootstrap" else strict_min

    if coverage < min_cov:
        print(f"\nERROR: coverage_score < {min_cov:.2f}")
        raise SystemExit(1)

if __name__ == "__main__":
    main()
