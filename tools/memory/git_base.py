import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def run(cmd):
    return subprocess.check_output(cmd, cwd=ROOT, text=True, encoding="utf-8").strip()

def detect_base_ref():
    # 1) env override
    import os
    env_base = os.getenv("WIKI_BASE_REF", "").strip()
    if env_base:
        return env_base

    # 2) upstream branch
    try:
        upstream = run(["git", "rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"])
        # örn: origin/feature-x -> çoğu projede PR base main olur, yine fallback deneyeceğiz
    except Exception:
        upstream = ""

    # 3) main/master var mı test
    candidates = ["origin/main", "origin/master"]
    if upstream:
        candidates.insert(0, upstream)

    for c in candidates:
        try:
            subprocess.check_output(["git", "rev-parse", "--verify", c], cwd=ROOT)
            return c
        except Exception:
            continue

    return "HEAD~1"
