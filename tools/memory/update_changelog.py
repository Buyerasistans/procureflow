import subprocess
from datetime import datetime
from pathlib import Path
import argparse

ROOT = Path(__file__).resolve().parents[2]
CHANGELOG_DIR = ROOT / "wiki" / "changelog"

def get_changed_files(base_ref="origin/main"):
    cmd = ["git", "diff", "--name-only", f"{base_ref}...HEAD"]
    out = subprocess.check_output(cmd, cwd=ROOT, text=True, encoding="utf-8")
    return [x.strip().replace("\\", "/") for x in out.splitlines() if x.strip()]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-ref", default="origin/main")
    parser.add_argument("--author", default="team/platform")
    args = parser.parse_args()

    today = datetime.now().strftime("%Y-%m-%d")
    target = CHANGELOG_DIR / f"{today}.md"
    CHANGELOG_DIR.mkdir(parents=True, exist_ok=True)

    changed = get_changed_files(args.base_ref)
    wiki_files = [f for f in changed if f.startswith("wiki/")]
    source_files = [f for f in changed if f.startswith("api/") or f.startswith("web/")]

    if target.exists():
        content = target.read_text(encoding="utf-8")
    else:
        content = f"# {today}\n\n"

    block = []
    block.append("## Otomatik Güncelleme Kaydı\n")
    block.append("### Güncellenen Wiki Sayfaları")
    if wiki_files:
        block.extend([f"- {w}" for w in wiki_files])
    else:
        block.append("- (yok)")
    block.append("\n### Etkilenen Kaynak Dosyalar")
    if source_files:
        block.extend([f"- {s}" for s in source_files[:200]])
    else:
        block.append("- (yok)")
    block.append(f"\n### Güncelleyen\n- {args.author}\n")
    block.append("### Risk Notu\n- (manuel doldur)\n")

    content += "\n" + "\n".join(block) + "\n"
    target.write_text(content, encoding="utf-8")
    print(f"Updated: {target.relative_to(ROOT).as_posix()}")

if __name__ == "__main__":
    main()
