# Discovery Lab Closure Note

**Tarih:** 2026-05-25
**Branch:** pr/strict-gate-payment-clean-v2
**Sorumlu:** Platform Ops + Claude Sonnet 4.6

---

## Kapatılan Kritikler

### K-1 — Converter Preflight NameError (P0)

| Alan | Değer |
| --- | --- |
| Commit | `eb639b6` |
| Etki | `/api/v1/ai-lab/analyze` 500 döndürüyordu; converter yoksa uygulama çöküyordu |
| Düzeltme | `converter_preflight()` içindeki `NameError` giderildi; yokluğu 422 + `error_code: converter_unavailable` ile karşılandı |

### K-2 — Teknik Exception UI'a Sızıyor (P0)

| Alan | Değer |
| --- | --- |
| Commit | `9d24ab3` |
| Etki | Ham Python traceback ve dosya yolu Discovery Lab arayüzünde kullanıcıya görünüyordu |
| Düzeltme | API hata sözleşmesi sanitize edildi; UI yalnızca `user_message` alanını gösteriyor |

### K-3 — Test Profili DB Drop Ediyordu (P1)

| Alan | Değer |
| --- | --- |
| Commit | `f51755f` |
| Etki | `pytest` koşusu Discovery Lab testleri sırasında tabloları drop edip production veriyi tehlikeye atabiliyordu |
| Düzeltme | `PYTEST_NO_DROP=1` + `nodrop` marker ile izole SQLite profili eklendi |

### K-4 — Converter Durumu Diagnose Edilemiyordu (P1)

| Alan | Değer |
| --- | --- |
| Commit | `4b2fc1b` |
| Etki | Ops converter'ın kurulu olup olmadığını kontrol edemiyordu |
| Düzeltme | `GET /api/v1/ai-lab/health/converter` endpoint eklendi; `converter_found`, `resolver_source`, `request_id` döndürüyor |

---

## Commit Kanıtları

```
eb639b6  fix(discovery-lab): resolve converter preflight NameError and sanitize API error contract
9d24ab3  fix(discovery-lab-ui): normalize Turkish copy and hide technical exception details
8dd9527  test(discovery-lab): add regression coverage for converter-missing and sanitized errors
f51755f  test(infra): add no-drop backend test profile for discovery-lab
4b2fc1b  feat(ai-lab): add converter health endpoint and structured diagnostics
630e3e4  docs(release): add discovery-lab release gate runbook
```

---

## Release Gate Sonucu

Komut: `scripts\discovery_lab_release_gate.cmd`

| Adım | Sonuç |
| --- | --- |
| `PYTEST_NO_DROP=1 pytest -m nodrop tests/test_ai_lab_router.py` | PASS |
| `npm.cmd run test:run -- discovery-lab.test.tsx` | PASS |
| `npm.cmd run type-check` | PASS (0 hata) |
| `npm.cmd run build` | PASS |
| `git diff --check` | PASS (whitespace yok) |

Runbook: [docs/runbooks/discovery-lab-release-gate.md](discovery-lab-release-gate.md)

---

## Kalan Non-Blocker Borçlar

Bu maddeler Discovery Lab hotfix'i **bloke etmez**; sonraki döngüde planlanmalıdır.

| # | Borç | Öncelik | İlgili Paket |
| --- | --- | --- | --- |
| D-1 | `PF_` katman/blok metadata extractor tamamlanması | Orta | Paket 1 |
| D-2 | BOM / reçete motoru tam entegrasyon (şu an kısmen çalışır) | Orta | Paket 1 |
| D-3 | Harici LLM entegrasyonu (AI Gateway) — şu an fallback modunda | Düşük | Paket 2 |
| D-4 | Mantıksal tutarlılık kontrolleri ve karar destek soruları | Düşük | Paket 2 |
| D-5 | AI teknik sidebar tam kullanıcı etkileşimi | Düşük | Paket 3 |
| D-6 | BOM visualizer tree-view son hali | Düşük | Paket 3 |
| D-7 | PostgreSQL server log rotasyonu aktifleştirme | Düşük | Ops |

---

## Rollback Planı

Discovery Lab hotfix herhangi bir DB şeması değişikliği içermez.
Geri almak için:

```bash
# Frontend + backend Discovery Lab değişikliklerini geri al
git revert eb639b6 9d24ab3 8dd9527 f51755f 4b2fc1b 630e3e4 --no-commit
git commit -m "revert: rollback discovery-lab hotfix"
```

Alembic migration gerektiren değişiklik yoktur; sadece uygulama yeniden başlatılmalıdır.

---

## Geçiş Notu

Discovery Lab hotfix kapatılmıştır. Sonraki adım:
**Faz geçişi** — Non-blocker borçlar (D-1..D-6) yeni bir sprint planına alınmalı;
`ProcureFlow_AI_Discovery_Lab_Implementation_Plan.md` güncellenmeli.
