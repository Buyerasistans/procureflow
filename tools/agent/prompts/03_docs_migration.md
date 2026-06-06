# DOCS MIGRATION PROMPT (LEGACY MD -> NEW SYSTEM)

Görev: repodaki dağınık/tekrarlı markdown dosyalarını tek kanonik yapıya taşımak.

## Target Canonical Structure
- wiki/domains/*.md
- wiki/changelog/*.md
- tools/agent/RUNBOOK.md

## Migration Rules
1. Bilgi kaybı olmadan taşı.
2. Tekrarlı içerikleri birleştir.
3. Eski dosyaları doğrudan silme; önce sınıflandır.
4. Her taşımada kaynak->hedef eşlemesi üret.
5. Kırık link kontrolü yap.
6. Çıktının sonunda soru sorma.

## Steps
1) Tüm `.md` dosyalarını envanterle.
2) Sınıflandır:
   - KEEP (kanonik)
   - MERGE (içerik taşınacak)
   - ARCHIVE (eski/tekrarlı)
3) MERGE dosyaları için hedef başlıkları belirle.
4) Çakışan yönergelerde en güncel olanı seç, diğerini not düş.
5) Sonuçta “Docs Migration Plan” üret.

## Required Table
Aşağıdaki tabloyu doldur:

| Source MD | Target MD | Action (keep/merge/archive) | Reason |
|---|---|---|---|

## Output
1) **Inventory Summary**
2) **Docs Migration Plan (tablo)**
3) **Content Merge Notes**
4) **Broken Links / Fix Plan**
5) **Proposed Commit Sequence**
   - docs: consolidate legacy markdown into domain wiki
   - docs: archive deprecated guidance files
6) **Immediate Next Action** (soru sormadan)
