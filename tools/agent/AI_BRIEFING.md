# AI BRIEFING (AUTO) - MODEL AGNOSTIC

## Session Meta
date: 2026-05-22
branch: pr/strict-gate-payment-clean
mode: task
task: Kaldığım yerden devam
domain: payment-billing

## Read First
1. tools/agent/SESSION_CONTEXT.md
2. tools/agent/RUNBOOK.md
3. wiki/domains/payment-billing.md
4. wiki/changelog/2026-05-22.md
5. tools/agent/prompts/04_task_execution.md

## Git Snapshot
### status
 M .vscode/settings.json
 M tools/agent/RUNBOOK.md
 M tools/agent/local_snapshot.ps1
 M web/.gitignore
 M wiki/changelog/2026-05-21.md
 M wiki/changelog/2026-05-22.md
?? tools/agent/AI_BRIEFING.md
?? tools/agent/STATE.md
?? tools/agent/build_briefing.ps1
?? tools/agent/orchestrator.ps1
?? tools/agent/prompts/

### last 5 commits
c56dfb8 ci: upgrade actions and simplify dependency install
adeb0bd chore(deps): remove duplicate python-jose pin causing resolver conflict
44d18d1 fix(payment): guard duplicate succeeded webhook activation
bc21021 chore(agent): enforce strict close gate with hard-fail violations
cdbbc89 chore: stabilize local-first agent workflow and cleanup

## Rules
- Tek kaynak local repo.
- Domain-aware al.
- Wiki/changelog etkisini zorunlu yaz.
- Çıktı sonunda soru sorma, "Next Action" ile devam et.

## Prompt Body
# TASK EXECUTION PROMPT (DOMAIN-AWARE, STRICT)

Görev: <TASK>
Domain: <DOMAIN>

Bu görevi domain-aware ve local-first şekilde uygula.
AI_BRIEFING tek source of truth'tur.

## Hard Rules
1. Önce plan, sonra değişiklik.
2. Değişiklikleri atomik tut (küçük commit mantığı).
3. Her kod değişikliğinin domain etkisini yaz.
4. Wiki/changelog güncellemesini zorunlu kontrol et.
5. Çıktının sonunda soru sorma.
6. Var olmayan dosya adı uydurma. Sadece repoda gerçekten bulunan path'leri kullan.
7. Genel/boş şablon cevap yasak. Her bölüm somut dosya ve somut aksiyon içermeli.
8. AI_BRIEFING dışındaki tarihsel mesajları referans alma. Doğrula, uygula, raporla.

## Mandatory Preflight (zorunlu)
Aşağıdakileri ilk adımda çıkar:
- git branch (HEAD)
- git status kısa özet
- var olan hedef dosyalar listesi (kod + wiki + changelog)
- domain dosyası path doğrulaması (`wiki/domains/<DOMAIN>.md`)

Eğer domain dosyası yoksa:
- `wiki/domains/<DOMAIN>.md` oluşturma planı yaz
- `payment-billing` fallback gerekçesini notla
- yine de icraya devam et (durma, soru sorma)

## Execution Workflow
1) Scope çıkar (ne var / ne yok)
2) Dosya bazlı değişiklik planı (yalnızca gerçek path)
3) Uygulama adımları
4) Test adımları
5) Wiki/changelog güncellemeleri
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
9) **Next Action** (soru sormadan, uygulanabilir tek sonraki adım)

## Output Quality Constraints (strict)
- `Files To Change` bölümünde her satır tam path içermeli.
- En az 1 kod dosyası + 1 wiki/changelog dosyası belirtmeden plan tamamlanmış sayılmaz.
- `domain_file.txt`, `changelog.txt`, `some_file` gibi placeholder isimler yasak.
- Her bölüm 2–6 madde arası, kısa ve operasyonel olmalı.

## Quality Gates
- Domain dosyası güncellendi mi?
- Changelog girdisi eklendi mi?
- Cross-domain etki varsa notlandı mı?

## Mandatory End-of-Session Verification (Evidence Mode) [ZORUNLU]

Oturum kapanmadan hemen önce aşağıdaki kanıt turu zorunludur:

1) Komut çıktıları:
- `git status --short`
- `git diff -- <değişen_kod_dosyası_1>`
- `git diff -- <değişen_kod_dosyası_2>`
- `git diff -- wiki/domains/<domain>.md`
- `git diff -- wiki/changelog/YYYY-MM-DD.md`

2) Teknik doğrulama (kod değiştiyse):
- Kritik guard/koşulun satır referansı (`grep -n` veya eşdeğeri)
- Log/event/side-effect satır referansı
- “nasıl çalışıyor” kısa akış (maks 8 satır)

3) Test/Validation:
- En az 1 pozitif + 1 negatif/duplicate senaryosu
- Otomatik test yoksa: önerilen test dosyası ve test isimleri

4) Zorunlu çıktı başlıkları:
- `Evidence`
- `Diff Summary`
- `Risk Check`
- `Next Action`

Kurallar:
- Soru sorma.
- Varsayım yapma; yalnızca repo çıktısı ve diff ile konuş.
- Diff çok büyükse dosya yolu + ilk 2KB preview + özet metrik ver.
