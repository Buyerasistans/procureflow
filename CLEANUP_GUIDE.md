# ProcureFlow — Gereksiz Dosyaları Temizleme Rehberi

## Kritik Uyari

Bu rehberdeki hicbir .db veya .env dosyasi, aktif olarak kullanilip kullanilmadigi dogrulanmadan silinmemelidir.

Bu proje PostgreSQL tek kaynak modeline gecirildi:

- api/.env icinde DATABASE_URL PostgreSQL olmalidir.
- tests/conftest.py icinde TEST_DATABASE_URL (PostgreSQL) kullanilir.
- Kalan .db dosyalari sadece eski/legacy artefakt olabilir.

Sonuc: .db dosyalari aktif kullanilmadigi dogrulanmadan silinmemeli; once yedek alip baglantiyi teyit et.

## 1) Temizlenecek Dosyalar Listesi

Aşağıda bulunan dosyaları projenizden silin. Bunlar git version control'ün dışında tutulması gereken dosyalardır.

### 1.1 Root Level — Yalnızca Geliştirme Amaçlı

```bash
# SILINECEKLER (git status'te görünmesi gerekiyor, sonra .gitignore'a eklenirse gözden kaybolur)
→ delete: rm -f /d check_*.py
→ delete: rm -f /d create_*.py
→ delete: rm -f /d debug_*.py
→ delete: rm -f /d decode_jwt.py
→ delete: rm -f /d final_test.py
→ delete: rm -f /d find_admin.py
→ delete: rm -f /d fix_*.py
→ delete: rm -f /d init_db.py
→ delete: rm -f /d inspect_users_table.py
→ delete: rm -f /d load_*.py
→ delete: rm -f /d reset_admin_password.py
→ delete: rm -f /d seed_*.py
→ delete: rm -f /d test_*.py (at root; move to tests/ if needed)

# NEDEN: Tek seferlik tanı betikleri, canlı hale çıkmaya hazır değil
```

### 1.2 CSV/Excel Demo Dosyaları

```bash
→ delete: rm -f /d PİZZAMAX_TEKLİF_.csv
→ delete: rm -f /d PİZZAMAX_TEKLİF_.xlsx

# NEDEN: Test veya import satışetkinliği için eklenmiş, production'a yüklenmemeli
```

### 1.3 Veritabani Dosyalari (Otomatik Silme YOK)

```bash
# ONCE KONTROL ET
type api\.env

# Eger api/.env icinde su satir varsa PostgreSQL aktif gelistirme veritabanidir:
# DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/procureflow

# Eger tests/conftest.py icinde su satir varsa PostgreSQL test veritabanidir:
# TEST_DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/procureflow_test

# SADECE artik kullanilmayan KOPYA dosyalar icin:
# 1. yedek al
# 2. dogru DB yolunu teyit et
# 3. sonra sil

# NEDEN: .gitignore'a zaten ekli; commit'lemişse silinmeli
# NEDEN: .gitignore'a ekli olmasi silinebilecegi anlamina gelmez
# Kural: aktif veri kaynagini silme, sadece git takibinden cikar veya yedekleyip arsivle

### 1.4 Token Dosyaları

```bash
→ delete: rm -f /d token.txt

# NEDEN: Geçici test tokeni
```

### 1.5 API Kök Klasörü Temizliği

```bash
→ delete: rm -f /d api/__pycache__/
→ delete: rm -f /d api/.pytest_cache/

# NEDEN: Build artifacts, .gitignore'ın kapsamı dışında kalabilir
```

### 1.6 Frontend Temizliği

```bash
→ delete: rm -rf /d web/node_modules/
→ delete: rm -rf /d web/dist/
→ delete: rm -rf /d web/.vite/
→ delete: rm -f /d web/.coverage/

# NEBEN: npm install / npm run build tekrar oluşturacak
```

## 2) Aksiyon Planı

### Adım 1 — Mevcut Bakımı İnceleme

```bash
cd d:\Projects\procureflow

# Aktif DB konfigurasyonunu kontrol et
type api\.env

# Veritabani dosyalari gercekte var mi bak
Get-ChildItem -Path . -Filter *.db -Recurse | Select-Object FullName, Length

# Test DB baglantisini kontrol et
type tests\conftest.py

# Tekrar oluşturulabilir dosyaları listele
ls -la *.csv *.xlsx 2>/dev/null || echo "Demo files not found (good)"
ls -la check_*.py create_*.py debug_*.py 2>/dev/null | head -20
```

### Adım 2 — Clean Script Yazma (Opsiyonel)

```bash
#!/bin/bash
# cleanup.sh
set -e

echo "🧹 ProcureFlow cleanup başlıyor..."

# Temp python scripts
rm -f check_*.py create_*.py debug_*.py decode_jwt.py final_test.py find_admin.py fix_*.py init_db.py inspect_users_table.py load_*.py reset_admin_password.py seed_*.py test_*.py 2>/dev/null || true

# Demo data
rm -f PİZZAMAX_TEKLİF_.csv PİZZAMAX_TEKLİF_.xlsx 2>/dev/null || true

# Token files
rm -f token.txt 2>/dev/null || true

# Frontend builds (regenerate with npm install/build)
rm -rf web/node_modules web/dist web/.vite web/.coverage 2>/dev/null || true

# Python cache
find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true

echo "✅ Cleanup tamamlandı!"
```

### Adım 3 — .gitignore Güncelleme

```bash
# Mevcut .gitignore'u yedekle
cp .gitignore .gitignore.backup

# Yeni .gitignore'u kopyala (tarafımızdan sağlanmış)
cp .gitignore.updated .gitignore

# Kontrol et
git status --short | head -50
```

### Adım 4 — Git'ten Çıkar (Eğer Yanlışlıkla Commitlendiyse)

```bash
# Aktif DB dosyasini SILME, sadece git takibinden cikar
git rm --cached *.db *.csv *.xlsx token.txt check_*.py 2>/dev/null || true
git commit -m "cleanup: remove tracked dev artifacts and temp files"

# Eğer push etmişse ve gerçekten silinmesi gerekiyorsa (danger!)
# git filter-branch --tree-filter 'rm -f *.db' -- --all
# ⚠️ Bunu sadeta yapmazsanız! Tüm history değişecek
```

### Adım 5 — Kontrol Listesi

```bash
# Doğrula: Aşağıdaki hiçbiri git status'te görünmüyor mu?
git status

# Beklenen: Clean working tree (hiç değişiklik yok)
# VEYA sadece .gitignore.updated kaldırıldı olmalı

# Doğrula: .gitignore'u güncelle ve eski sürümü sil
rm .gitignore.updated

# Final commit
git add .gitignore
git commit -m "docs: update gitignore and architecture guidelines"
```

## 3) Backend Dosya Organizasyonu Kontrol Listesi

| Dosya/Klasör | Bulunacak Yer | Status | Aksion |
|---|---|---|---|
| `check_tables.py` | Kök (Silinecek) | ❌ Git'te varsa sil | `rm` |
| `create_admin.py` | Kök (Silinecek) | ❌ Git'te varsa sil | `rm` |
| `__init__.py` | `api/models/` | ✅ OLMALI | Kontrol |
| `__init__.py` | `api/schemas/` | ✅ OLMALI | Kontrol |
| `__init__.py` | `api/routers/` | ✅ OLMALI | Kontrol |
| `__init__.py` | `api/services/` | ✅ OLMALI | Kontrol |
| Legacy quote router | `api/routers/` | ✅ Kaldirildi | RFQ runtime `quotes.py` uzerinde |
| `settings_router.py` | `api/routers/` | ⚠️ Eski versyon | Konsol et → `advanced_settings_router.py` |
| `email_service.py` | `api/services/` | ✅ MODERN (Date/Message-ID) | Kontrol |
| `.env` | Kök | ⚠️ Silme karari vermeden once kontrol et | Aktif degilse gitignore'a al |
| `.env.example` | Kök | ✅ OLMALI | Kontrol |

## 4) Frontend Dosya Organizasyonu Kontrol Listesi

| Dosya/Klasör | Bulunacak Yer | Status | Aksion |
|---|---|---|---|
| `node_modules/` | `web/` | ❌ Silinecek (gitignore'd) | `rm -rf` |
| `dist/` | `web/` | ❌ Silinecek (build artifact) | `rm -rf` (regenerate ile) |
| `SupplierResponsePortal.tsx` | `web/src/components/` | ✅ MODERN (3 tabs) | Kontrol |
| `package.json` | `web/` | ✅ OLMALI | Kontrol |
| `tsconfig.json` | `web/` | ✅ OLMALI | Kontrol |
| `.eslintrc` | `web/` | ✅ Önerilen | Kontrol/ekle |
| `vite.config.ts` | `web/` | ✅ OLMALI | Kontrol |

## 5) Git Yayılım Kontrol Listesi

```bash
# Proje kökünde çalışın
cd d:\Projects\procureflow

# 1. Status clean mi? (hiç untracked vs. yok)
git status
# Expected: "On branch main, nothing to commit, working tree clean"

# 2. Gitignore'ı kontrol et
cat .gitignore | grep -E "__pycache__|\.db|\.venv" | head -5

# 3. Son 5 commit'i kontrol et (temp file yok mu?)
git log --oneline -5
# Should NOT have: "add temp files", "debug script", etc.

# 4. Branches
git branch -a
# Expected: main (or master), maybe feature branches

# 5. Remote setup
git remote -v
# Expected: origin → https://github.com/yourorg/procureflow.git
```

## 6) Dosya Toplama Kodu (Python)

Eğer yukarıdaki script'leri tetiklemeye açık iseniz, bunları `cleanup.py` olarak kaydedebilirsiniz (veya çalıştırılabilir bash'e çevirebilirsiniz):

```python
#!/usr/bin/env python3
import os
import shutil
from pathlib import Path

def cleanup():
    root = Path(".")
    
    # Silinecek patterns
    to_delete = [
        "check_*.py", "create_*.py", "debug_*.py", 
        "decode_jwt.py", "final_test.py", "find_admin.py",
        "fix_*.py", "init_db.py", "inspect_users_table.py",
        "load_*.py", "reset_admin_password.py", "seed_*.py",
        "PİZZAMAX_TEKLİF_.csv", "PİZZAMAX_TEKLİF_.xlsx",
        "token.txt"
    ]
    
    # Silinecek directoriler
    to_delete_dirs = [
        "web/node_modules", "web/dist", "web/.vite",
        "api/__pycache__", "api/.pytest_cache"
    ]
    
    for pattern in to_delete:
        for f in root.glob(pattern):
            if f.is_file():
                print(f"🗑️  Deleting: {f}")
                f.unlink()
    
    for d in to_delete_dirs:
        path = root / d
        if path.exists():
            print(f"🗑️  Deleting: {path}")
            shutil.rmtree(path)
    
    print("✅ Cleanup complete!")

if __name__ == "__main__":
    cleanup()
```

---

## Özet

| Kategori | Sayı | Açıklama |
|---|---|---|
| **Silinecek Root Scripts** | 15+ | chec, create, debug, fix, init, inspect, load, seed vb. |
| **Silinecek CSV/Excel** | 2 | Demo verileri |
| **.db Dosyalari** | 3+ | Silmeden once aktif kullanim ve yedek kontrolu zorunlu |
| **Node cleanup** | 1 | `web/node_modules/` (npm install'la regenerate) |
| **Python cache cleanup** | 2 | `__pycache__/`, `.pytest_cache/` |
| **Yeniden yapılandırılacak Routers** | 1 | `settings_router.py` → `advanced_settings_router.py` |

**Tahmini Disk Boşaltılması:** ~500 MB-2 GB (node_modules'e bağlı olarak)

---

**Son Güncelleme:** 4 Nisan 2026
