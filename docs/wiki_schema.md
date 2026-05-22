# LLM Wiki Schema (Project Memory Constitution)

Bu dosya, repo içindeki `wiki/` klasörünün nasıl üretileceğini, güncelleneceğini ve denetleneceğini tanımlar.

## 1) Amaç

LLM araçlarının seans bazlı amnezisini azaltmak için:
- İnsan-okunur,
- Kaynak dosya referanslı,
- Güncellik kontrolüne sahip
bir ikinci beyin (wiki) tutulur.

## 2) Kapsam

Bu şema aşağıdaki alanları kapsar:
- `wiki/index/*`
- `wiki/domains/*`
- `wiki/flows/*`
- `wiki/components/*`
- `wiki/adr/*`
- `wiki/changelog/*`

## 3) Zorunlu Frontmatter Alanları

`wiki/domains/*`, `wiki/flows/*`, `wiki/components/*`, `wiki/adr/*` altındaki HER md dosyasında aşağıdaki alanlar zorunludur:

- `title`: Sayfa başlığı
- `owned_by`: Sorumlu ekip/rol
- `last_verified_at`: YYYY-MM-DD
- `confidence`: 0.00 - 1.00 arası
- `stale_after_days`: Sayfanın kaç gün sonra stale sayılacağı
- `source_files`: Kanıt dosyaları listesi (repo-relative path)

Örnek:

```yaml
---
title: Quote & Approval Domain
owned_by: backend+frontend
last_verified_at: 2026-05-21
confidence: 0.78
stale_after_days: 14
source_files:
  - api/routers/quote_router.py
  - api/services/quote_service.py
  - web/src/pages/QuoteDetailPage.tsx
---
4) Zorunlu Yazım Kuralları
Teknik iddia varsa en az 1 source_files kanıtı olmalı.
Akış anlatımı varsa ilgili API + UI dosyaları birlikte referanslanmalı.
Belirsiz bilgi Assumption: etiketiyle yazılmalı.
“TODO” bırakılabilir ama owner ve target_date içermelidir.
Sayfada kaynak dosya silindiyse sayfa Needs Repair olarak işaretlenmelidir.
5) Operasyon Döngüsü
Ingest (kod sonrası güncelleme)
Kod değişikliği sonrası ilgili wiki sayfaları güncellenir.
wiki/changelog/YYYY-MM-DD.md dosyasına kayıt düşülür.
Query (kod öncesi plan)
Önce wiki/ + docs/ üzerinden plan çıkarılır.
Sonra gerçek kod dosyalarıyla doğrulama yapılır.
Lint (haftalık bakım)
stale kontrolü (last_verified_at + stale_after_days)
kırık link kontrolü
olmayan source_files kontrolü
6) Hariç Tutma (Ingest Exclude)
Aşağıdaki dizin/dosyalar ingest kapsamı dışıdır:

**/node_modules/**
**/.venv/**
**/__pycache__/**
**/.mypy_cache/**
**/.ruff_cache/**
**/dist/**
**/uploads/**
**/tmp/**
**/backups/**
**/_deploy_extract_tmp/**
**/.restore_safety_*/**
Binary büyük dosyalar (.png, .zip, büyük .xlsx vb.)
7) Kalite Eşiği
Domain sayfalarında confidence < 0.60 ise “yüksek riskli bilgi” kabul edilir.
14 günü aşan stale domain sayfaları sprint içinde öncelikli güncellenmelidir.
PR sürecinde değişen domain için wiki güncellemesi yoksa PR bloke edilebilir.
8) Çıktı Sözleşmesi (AI için)
AI aşağıdaki formatı izlemelidir:

Önce kısa plan
Sonra etkilenen dosyalar
Sonra riskler
Son olarak doğrulama checklist Her bölümde mümkünse source_files referansı verilmelidir.
