import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def _exists_ref(ref: str) -> bool:
    try:
        subprocess.check_output(["git", "rev-parse", "--verify", ref], cwd=ROOT)
        return True
    except Exception:
        return False

def detect_base_ref() -> str:
    # 1) manuel override
    env_ref = os.getenv("WIKI_BASE_REF", "").strip()
    if env_ref:
        return env_ref

    # 2) CI PR target branch
    gh_base = os.getenv("GITHUB_BASE_REF", "").strip()
    if gh_base:
        candidate = f"origin/{gh_base}"
        if _exists_ref(candidate):
            return candidate

    # 3) default target: main/master
    for c in ("origin/main", "origin/master"):
        if _exists_ref(c):
            return c

    # 4) son çare
    return "HEAD~1"
