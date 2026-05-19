from __future__ import annotations

import json
import re
from collections import Counter
from itertools import combinations
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
WEB_PAGES = {
    "home": ROOT / "web" / "src" / "pages" / "PublicHomePage.tsx",
    "pricing": ROOT / "web" / "src" / "pages" / "PricingPlansPage.tsx",
    "strategic": ROOT / "web" / "src" / "pages" / "StrategicPartnerProgramPage.tsx",
    "supplier": ROOT / "web" / "src" / "pages" / "SupplierProgramPage.tsx",
    "channel": ROOT / "web" / "src" / "pages" / "ChannelPartnerProgramPage.tsx",
    "demo": ROOT / "web" / "src" / "pages" / "DemoRequestPage.tsx",
}
OUTPUT_JSON = ROOT / "public-content-similarity-audit.json"
OUTPUT_MD = ROOT / "docs" / "release" / "public-content-similarity-audit-2026-04-19.md"
STOP_WORDS = {
    "ve",
    "ile",
    "icin",
    "bu",
    "bir",
    "daha",
    "ile",
    "gibi",
    "veya",
    "olan",
    "olan",
    "icin",
    "the",
    "and",
    "birlikte",
    "tek",
    "hazir",
}


def extract_tokens(path: Path) -> list[str]:
    content = path.read_text(encoding="utf-8")
    strings = re.findall(r'"([^"\\]*(?:\\.[^"\\]*)*)"', content)
    text = " ".join(strings).lower()
    text = re.sub(r"[^a-z0-9ğüşöçıİĞÜŞÖÇ ]+", " ", text)
    tokens = [
        token for token in text.split() if len(token) > 2 and token not in STOP_WORDS
    ]
    return tokens


def jaccard(left: set[str], right: set[str]) -> float:
    if not left or not right:
        return 0.0
    return len(left & right) / len(left | right)


def overlap_terms(left_tokens: list[str], right_tokens: list[str]) -> list[str]:
    common = Counter(left_tokens) & Counter(right_tokens)
    return [term for term, _count in common.most_common(8)]


def main() -> None:
    token_map = {name: extract_tokens(path) for name, path in WEB_PAGES.items()}
    comparisons: list[dict[str, object]] = []
    for left, right in combinations(token_map.keys(), 2):
        left_tokens = token_map[left]
        right_tokens = token_map[right]
        score = round(jaccard(set(left_tokens), set(right_tokens)), 4)
        comparisons.append(
            {
                "left": left,
                "right": right,
                "similarity": score,
                "shared_terms": overlap_terms(left_tokens, right_tokens),
            }
        )

    comparisons.sort(key=lambda item: item["similarity"], reverse=True)
    flagged = [item for item in comparisons if float(item["similarity"]) >= 0.35]
    payload = {
        "threshold": 0.35,
        "pages": {
            name: str(path.relative_to(ROOT)) for name, path in WEB_PAGES.items()
        },
        "comparisons": comparisons,
        "flagged": flagged,
    }
    OUTPUT_JSON.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    lines = [
        "# Public Content Similarity Audit - 2026-04-19",
        "",
        "Bu rapor public sayfa metinlerinde tekrar riskini kontrol eder.",
        "Esik: Jaccard benzerligi >= 0.35 ise editor kontrolu onerilir.",
        "",
        "## Sonuc",
        "",
    ]
    if flagged:
        for item in flagged:
            lines.extend(
                [
                    f"- {item['left']} <-> {item['right']}: {item['similarity']}",
                    f"  Ortak terimler: {', '.join(item['shared_terms'])}",
                ]
            )
    else:
        lines.append("- Esik ustu birebir tekrar riski bulunmadi.")
    lines.extend(
        [
            "",
            "## En Yuksek Karsilastirmalar",
            "",
        ]
    )
    for item in comparisons[:5]:
        lines.append(f"- {item['left']} <-> {item['right']}: {item['similarity']}")
    lines.append("")
    OUTPUT_MD.write_text("\n".join(lines), encoding="utf-8")


if __name__ == "__main__":
    main()
