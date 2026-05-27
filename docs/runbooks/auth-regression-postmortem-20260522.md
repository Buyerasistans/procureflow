# Auth Regression Post-Mortem — 2026-05-22

**Tarih:** 2026-05-22  
**Etki:** Tüm normal kullanıcılar login yapamıyor (401 "Invalid credentials")  
**Süre:** Restore drill tamamlanana kadar (kısa dönem)  
**Kök neden:** DB wipe sonrası kullanıcılar re-seed edilmedi

---

## Özet

Üretim DB'si restore drill kapsamında DROP + RECREATE edildi. FastAPI başlangıcında
`ensure_runtime_super_admin()` yalnızca `super_admin` kaydını garanti eder. Normal
demo/scope kullanıcıları bu bootstrap akışında yer almaz. Sonuç: kullanıcı tablosunda
tek kayıt kaldı (super_admin) → normal kullanıcı login denemeleri "user not found"
→ 401 döndü. Sunucu tarafı logu "user_not_found" ile "wrong_password" arasında ayırt
etme imkânı olmadığından tanı güçleşti.

---

## Zaman Çizelgesi

| Zaman | Olay |
|-------|------|
| 03:17 | Üretim backup alındı |
| ~05:12 | DB DROP + RECREATE yapıldı |
| Hemen sonra | FastAPI restart → `ensure_runtime_super_admin()` çalıştı → 1 kullanıcı |
| Sonraki oturum | Tüm kullanıcı tiplerinde 401 gözlemlendi |
| Teşhis | `SELECT COUNT(*) FROM users` → 1 (super_admin) |
| Düzeltme | `bootstrap_scope_demo_data.py` çalıştırıldı → 22+ hesap |
| Doğrulama | super_admin + portaladmin login → HTTP 200 OK |

---

## Kök Neden Analizi

### Neden 401 döndü?

`_resolve_login_user()` e-posta bazlı arama yapar. Kullanıcı bulunamazsa `None`
döner. Login handler `not user` kontrolünde HTTPException 401 fırlatır. Bu yanıt
"yanlış şifre" yanıtıyla bilinçli olarak aynı tutulur (user enumeration önleme).
Dolayısıyla client tarafından iki durum ayırt edilemez.

### Neden super_admin çalıştı?

`ensure_runtime_super_admin()` her uvicorn başlangıcında `SUPER_ADMIN_PASSWORD` env
değeriyle super_admin hash'ini günceller. Bu nedenle super_admin her zaman geçerli
olur — DB wipe sonrasında dahi.

### Neden normal kullanıcılar kayboldu?

`bootstrap_runtime_defaults.py` ve `bootstrap_scope_demo_data.py` sadece explicit
çalıştırıldığında seed eder. DB wipe + restart sonrası bu scriptler otomatik
çalışmaz.

---

## Düzeltme

```bash
# 1. DB wipe sonrası çalıştır
api/.venv/bin/python -m api.scripts.bootstrap_runtime_defaults
api/.venv/bin/python -m api.scripts.bootstrap_scope_demo_data

# 2. Doğrula
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"portaladmin@buyerasistans.com.tr","password":"Aa1234!!"}'
# Beklenen: HTTP 200 + access_token
```

---

## Kod İyileştirmesi (bu incident sonrası)

`api/routers/auth.py` login handler'ına yapısal sunucu tarafı loglama eklendi:

```python
# user_not_found ve wrong_password ayrı log satırıyla kaydedilir
logger.warning("login_rejected reason=user_not_found email_domain=%s", domain)
logger.warning("login_rejected reason=wrong_password user_id=%s", user.id)
```

HTTP yanıtı her iki durumda da aynı kalır (401 "Invalid credentials") —
user enumeration koruması bozulmadı. Debug print satırı kaldırıldı.

---

## Önleme

| Adım | Açıklama |
|------|----------|
| DB wipe sonrası runbook | `bootstrap_runtime_defaults` + `bootstrap_scope_demo_data` her restore sonrası zorunlu |
| Log izleme | `login_rejected reason=user_not_found` spike'ı DB wipe sinyali olabilir |
| Test koruyucusu | `api/tests/test_auth_login.py` — 16 test, user_not_found/wrong_password/inactive/alias senaryolarını kapsar |

---

## İlgili Runbooklar

- [DB restore drill log](restore-drill-log.md)
- [HOSTING_DEPLOYMENT_TRACKER.md](../../HOSTING_DEPLOYMENT_TRACKER.md) — §10 seed komutları
