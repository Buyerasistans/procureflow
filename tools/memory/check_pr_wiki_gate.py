import json
import subprocess
from pathlib import Path
from git_base import detect_base_ref

ROOT = Path(__file__).resolve().parents[2]
CONFIG = ROOT / "tools" / "memory" / "config.json"

def changed_files(base_ref="origin/main"):
    out = subprocess.check_output(
        ["git", "diff", "--name-only", f"{base_ref}...HEAD"],
        cwd=ROOT, text=True, encoding="utf-8"
    )
    return [x.strip().replace("\\", "/") for x in out.splitlines() if x.strip()]

def is_ignored(path, prefixes):
    return any(path.startswith(p) for p in prefixes)

def main():
    cfg = json.loads(CONFIG.read_text(encoding="utf-8"))
    prefixes = cfg.get("diff_ignore_prefixes", [])
    rollout = cfg.get("rollout", {})
    mode = rollout.get("mode", "strict")
    bootstrap_min = float(rollout.get("bootstrap_min_coverage", 0.20))
    strict_min = float(rollout.get("strict_min_coverage", 1.00))
    min_cov = bootstrap_min if mode == "bootstrap" else strict_min

    base_ref = detect_base_ref()
    raw_changed = changed_files(base_ref)
    print(f"Base ref           : {base_ref}")

    changed = [f for f in raw_changed if not is_ignored(f, prefixes)]
    changed_set = set(changed)

    required = set()
    touched_domains = set()

    for rule in cfg["domain_rules"]:
        if any(any(p in f for p in rule["patterns"]) for f in changed):
            touched_domains.add(rule["name"])
            required.add(rule["wiki_file"])

    changed_wiki = {f for f in changed if f.startswith("wiki/domains/") and f.endswith(".md")}
    updated_required = required.intersection(changed_wiki)

    changed_domain_count = len(touched_domains)
    coverage = 1.0 if changed_domain_count == 0 else (len(updated_required) / changed_domain_count)

    print(f"Mode               : {mode}")
    print(f"Min coverage       : {min_cov:.2f}")
    print("Required wiki files:", sorted(required))
    print("Changed wiki files :", sorted(changed_wiki))
    print(f"Coverage score     : {coverage:.2f}")

    missing = sorted([w for w in required if w not in changed_set])

    # strict mode: full enforcement
    if mode == "strict":
        if missing:
            print("\nERROR: Missing required wiki updates:")
            for m in missing:
                print(f"- {m}")
            raise SystemExit(1)
        if coverage < min_cov:
            print(f"\nERROR: coverage_score < {min_cov:.2f}")
            raise SystemExit(1)
        print("\nOK: PR wiki gate passed (strict).")
        return

    # bootstrap mode: soft landing
    # En az 1 domain etkilenmişse, coverage min eşiğinin üstünde olmalı
    if changed_domain_count > 0 and coverage < min_cov:
        print(f"\nERROR: bootstrap coverage_score < {min_cov:.2f}")
        print("İpucu: En az birkaç ilgili wiki/domain dosyasını güncelle.")
        raise SystemExit(1)

    print("\nOK: PR wiki gate passed (bootstrap).")

if __name__ == "__main__":
    main()
