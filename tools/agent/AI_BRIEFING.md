# AI BRIEFING (AUTO) - MODEL AGNOSTIC

## Session Meta
date: 2026-05-22
branch: pr/strict-gate-payment-clean-v2
mode: task
task: Kaldm yerden devam
domain: payment-billing

## Read First
1. tools/agent/SESSION_CONTEXT.md
2. tools/agent/RUNBOOK.md
3. wiki/domains/payment-billing.md
4. wiki/changelog/2026-05-22.md
5. tools/agent/prompts/04_task_execution.md

## Git Snapshot
### status
 M .githooks/pre-commit
 M web/.gitignore
?? .claude/
?? docs/runbooks/restore-drill-log.md
?? tools/agent/build_briefing.ps1
?? tools/agent/orchestrator.ps1
?? tools/agent/prompts/


### last 5 commits
98a356c test(agent): restore session context + memory pipeline smoke test
fb0e557 fix(security/dbre): PR-1..4 ÔÇö deny-by-default guard, bootstrap secret, backup hardening, DB runbook
30e1386 css: Faz-4 ÔÇö token catalog geni┼şletmesi + yeni panel CSS dosyalar─▒n─▒n tokenizasyonu
4842d97 feat(css): Faz-3 ÔÇö token katalogu genisletme + 1197 hex gecisi + guvenlik
3197331 refactor(css): Faz-2 ÔÇö hardcoded hex ÔåÆ design token ge├ği┼şi (top 5 dosya)


## Rules
- Tek kaynak local repo.
- Domain-aware al.
- Wiki/changelog etkisini zorunlu yaz.
- kt sonunda soru sorma, "Next Action" ile devam et.

## Prompt Body
# TASK EXECUTION PROMPT (DOMAIN-AWARE, STRICT)

GÃ¶rev: <TASK>
Domain: <DOMAIN>

Bu gÃ¶revi domain-aware ve local-first ÅŸekilde uygula.
AI_BRIEFING tek source of truth'tur.

## Hard Rules
1. Ã–nce plan, sonra deÄŸiÅŸiklik.
2. DeÄŸiÅŸiklikleri atomik tut (kÃ¼Ã§Ã¼k commit mantÄ±ÄŸÄ±).
3. Her kod deÄŸiÅŸikliÄŸinin domain etkisini yaz.
4. Wiki/changelog gÃ¼ncellemesini zorunlu kontrol et.
5. Ã‡Ä±ktÄ±nÄ±n sonunda soru sorma.
6. Var olmayan dosya adÄ± uydurma. Sadece repoda gerÃ§ekten bulunan path'leri kullan.
7. Genel/boÅŸ ÅŸablon cevap yasak. Her bÃ¶lÃ¼m somut dosya ve somut aksiyon iÃ§ermeli.
8. AI_BRIEFING dÄ±ÅŸÄ±ndaki tarihsel mesajlarÄ± referans alma. DoÄŸrula, uygula, raporla.

## Mandatory Preflight (zorunlu)
AÅŸaÄŸÄ±dakileri ilk adÄ±mda Ã§Ä±kar:
- git branch (HEAD)
- git status kÄ±sa Ã¶zet
- var olan hedef dosyalar listesi (kod + wiki + changelog)
- domain dosyasÄ± path doÄŸrulamasÄ± (`wiki/domains/<DOMAIN>.md`)

EÄŸer domain dosyasÄ± yoksa:
- `wiki/domains/<DOMAIN>.md` oluÅŸturma planÄ± yaz
- `payment-billing` fallback gerekÃ§esini notla
- yine de icraya devam et (durma, soru sorma)

## Execution Workflow
1) Scope Ã§Ä±kar (ne var / ne yok)
2) Dosya bazlÄ± deÄŸiÅŸiklik planÄ± (yalnÄ±zca gerÃ§ek path)
3) Uygulama adÄ±mlarÄ±
4) Test adÄ±mlarÄ±
5) Wiki/changelog gÃ¼ncellemeleri
6) Risk ve rollback

## Required Output Format
1) **Technical Plan (max 10 madde)**  
2) **Files To Change (real repo paths only)**  
3) **Domain Mapping**  
4) **Implementation Notes**  
5) **Validation/Test Plan**  
6) **Wiki/Changelog Updates**  
7) **Commit Plan (atomic)**  
8) **Risks & Rollback**  
9) **Next Action** (soru sormadan, uygulanabilir tek sonraki adÄ±m)

## Output Quality Constraints (strict)
- `Files To Change` bÃ¶lÃ¼mÃ¼nde her satÄ±r tam path iÃ§ermeli.
- En az 1 kod dosyasÄ± + 1 wiki/changelog dosyasÄ± belirtmeden plan tamamlanmÄ±ÅŸ sayÄ±lmaz.
- `domain_file.txt`, `changelog.txt`, `some_file` gibi placeholder isimler yasak.
- Her bÃ¶lÃ¼m 2â€“6 madde arasÄ±, kÄ±sa ve operasyonel olmalÄ±.

## Quality Gates
- Domain dosyasÄ± gÃ¼ncellendi mi?
- Changelog girdisi eklendi mi?
- Cross-domain etki varsa notlandÄ± mÄ±?

## Mandatory End-of-Session Verification (Evidence Mode) [ZORUNLU]

Oturum kapanmadan hemen Ã¶nce aÅŸaÄŸÄ±daki kanÄ±t turu zorunludur:

1) Komut Ã§Ä±ktÄ±larÄ±:
- `git status --short`
- `git diff -- <deÄŸiÅŸen_kod_dosyasÄ±_1>`
- `git diff -- <deÄŸiÅŸen_kod_dosyasÄ±_2>`
- `git diff -- wiki/domains/<domain>.md`
- `git diff -- wiki/changelog/YYYY-MM-DD.md`

2) Teknik doÄŸrulama (kod deÄŸiÅŸtiyse):
- Kritik guard/koÅŸulun satÄ±r referansÄ± (`grep -n` veya eÅŸdeÄŸeri)
- Log/event/side-effect satÄ±r referansÄ±
- â€œnasÄ±l Ã§alÄ±ÅŸÄ±yorâ€ kÄ±sa akÄ±ÅŸ (maks 8 satÄ±r)

3) Test/Validation:
- En az 1 pozitif + 1 negatif/duplicate senaryosu
- Otomatik test yoksa: Ã¶nerilen test dosyasÄ± ve test isimleri

4) Zorunlu Ã§Ä±ktÄ± baÅŸlÄ±klarÄ±:
- `Evidence`
- `Diff Summary`
- `Risk Check`
- `Next Action`

Kurallar:
- Soru sorma.
- VarsayÄ±m yapma; yalnÄ±zca repo Ã§Ä±ktÄ±sÄ± ve diff ile konuÅŸ.
- Diff Ã§ok bÃ¼yÃ¼kse dosya yolu + ilk 2KB preview + Ã¶zet metrik ver.

