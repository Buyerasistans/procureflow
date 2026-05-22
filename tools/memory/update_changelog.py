#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from __future__ import annotations

import argparse
import datetime as dt
import os
import re
import subprocess
from pathlib import Path
from typing import List, Tuple


AUTO_SECTION_TITLE = "## Otomatik Güncelleme Kaydı"
AUTO_UPDATED_WIKI_TITLE = "### Güncellenen Wiki Sayfaları"
AUTO_CHANGED_SRC_TITLE = "### Etkilenen Kaynak Dosyalar"
UPDATED_BY_TITLE = "### Güncelleyen"
RISK_NOTE_TITLE = "### Risk Notu"


def run_git(args: List[str]) -> str:
    result = subprocess.run(
        ["git"] + args,
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def get_repo_root() -> Path:
    out = run_git(["rev-parse", "--show-toplevel"])
    if out:
        return Path(out)
    return Path.cwd()


def get_changed_files() -> List[str]:
    out = run_git(["status", "--porcelain"])
    if not out:
        return []
    files: List[str] = []
    for line in out.splitlines():
        if len(line) < 4:
            continue
        p = line[3:].strip()
        if " -> " in p:  # rename
            parts = [x.strip() for x in p.split(" -> ")]
            files.extend(parts)
        else:
            files.append(p)
    # unique preserve order
    seen = set()
    uniq = []
    for f in files:
        if f not in seen:
            seen.add(f)
            uniq.append(f)
    return uniq


def split_sections(md: str) -> List[Tuple[str, str]]:
    """
    Returns list of (header, body) where header starts with ## ... .
    Content before first ## is stored as ('__PREFACE__', body).
    """
    lines = md.splitlines()
    sections: List[Tuple[str, List[str]]] = []
    current_header = "__PREFACE__"
    current_body: List[str] = []

    header_re = re.compile(r"^##\s+.+$")
    for ln in lines:
        if header_re.match(ln):
            sections.append((current_header, current_body))
            current_header = ln.strip()
            current_body = []
        else:
            current_body.append(ln)

    sections.append((current_header, current_body))
    out: List[Tuple[str, str]] = []
    for h, b in sections:
        out.append((h, "\n".join(b).rstrip()))
    return out


def render_sections(sections: List[Tuple[str, str]]) -> str:
    chunks: List[str] = []
    for h, b in sections:
        if h == "__PREFACE__":
            if b.strip():
                chunks.append(b.strip())
            continue
        chunks.append(h)
        if b.strip():
            chunks.append(b.strip())
    return "\n\n".join(chunks).rstrip() + "\n"


def ensure_base_template_if_missing(content: str, date_str: str, author: str) -> str:
    if content.strip():
        return content

    base = f"""# Changelog - {date_str}

## Session Notes

- Session initialized.

## Yapılan Değişiklikler

- (manuel doldur)

## Etkilenen Domain(ler)

- (manuel doldur)

## Risk Notu

- (manuel doldur)

## Güncelleyen

- {author}
"""
    return base.rstrip() + "\n"


def dedupe_auto_sections(content: str) -> str:
    """
    Keep only first AUTO section. Remove subsequent repeated AUTO sections entirely.
    """
    sections = split_sections(content)
    out: List[Tuple[str, str]] = []
    auto_seen = False

    for h, b in sections:
        if h.strip() == AUTO_SECTION_TITLE:
            if auto_seen:
                continue
            auto_seen = True
            out.append((h, b))
        else:
            out.append((h, b))

    return render_sections(out)


def build_auto_section(updated_wiki: List[str], changed_src: List[str], author: str) -> str:
    lines: List[str] = []
    lines.append(AUTO_SECTION_TITLE)
    lines.append("")
    lines.append(AUTO_UPDATED_WIKI_TITLE)
    if updated_wiki:
        for f in updated_wiki:
            lines.append(f"- {f}")
    else:
        lines.append("- (yok)")
    lines.append("")
    lines.append(AUTO_CHANGED_SRC_TITLE)
    if changed_src:
        for f in changed_src:
            lines.append(f"- {f}")
    else:
        lines.append("- (yok)")
    lines.append("")
    lines.append(UPDATED_BY_TITLE)
    lines.append(f"- {author}")
    lines.append("")
    lines.append(RISK_NOTE_TITLE)
    lines.append("- (manuel doldur)")
    return "\n".join(lines).rstrip() + "\n"


def upsert_auto_section(content: str, auto_block: str) -> str:
    """
    If AUTO section exists, replace first one.
    If not exists, append once.
    """
    sections = split_sections(content)

    auto_idx = -1
    for i, (h, _) in enumerate(sections):
        if h.strip() == AUTO_SECTION_TITLE:
            auto_idx = i
            break

    auto_sections = split_sections(auto_block)
    # auto_block starts with a ## header, no preface expected
    replacement = [(h, b) for (h, b) in auto_sections if h != "__PREFACE__"]

    if auto_idx >= 0:
        # replace existing auto section with new block (single section body)
        # auto_block is a single ## section logically
        sections[auto_idx] = replacement[0]
    else:
        sections.append(replacement[0])

    return render_sections(sections)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--author", default="team/platform")
    args = parser.parse_args()

    repo_root = get_repo_root()
    os.chdir(repo_root)

    today = dt.date.today().isoformat()
    changelog_path = repo_root / "wiki" / "changelog" / f"{today}.md"
    changelog_path.parent.mkdir(parents=True, exist_ok=True)

    existing = ""
    if changelog_path.exists():
        existing = changelog_path.read_text(encoding="utf-8", errors="replace")

    existing = ensure_base_template_if_missing(existing, today, args.author)

    # 1) duplicate auto sections temizle
    normalized = dedupe_auto_sections(existing)

    # 2) changed files çıkar
    changed = get_changed_files()
    updated_wiki = sorted([f for f in changed if f.startswith("wiki/") and f.endswith(".md")])
    changed_src = sorted([f for f in changed if not f.startswith("wiki/")])

    # 3) auto section upsert (append değil replace)
    auto_block = build_auto_section(updated_wiki=updated_wiki, changed_src=changed_src, author=args.author)
    updated = upsert_auto_section(normalized, auto_block)

    # 4) final safety: tekrar dedupe
    updated = dedupe_auto_sections(updated)

    changelog_path.write_text(updated, encoding="utf-8", newline="\n")
    print(f"Updated: {changelog_path.as_posix().replace(str(repo_root).replace(chr(92), '/').rstrip('/') + '/', '')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
