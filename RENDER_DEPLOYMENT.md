# Render.com Deployment Kilavuzu

## Sorunlar ve Cozumleri

### Sorun 1: Admin Login Basarisiz

**Nedeni**: Render.com tarafinda `DATABASE_URL` veya admin kullanicisi set edilmedi.

**Cozum**:

1. Render.com Dashboard ac.
2. `procureflow-api` servisine git.
3. Environment Variables bolumunde gerekli degiskenleri set et.

## Gerekli Environment Variables

| Variable | Deger | Ornek | Notlar |
| --- | --- | --- | --- |
| `DATABASE_URL` | Postgres URL | `postgresql+psycopg://user:pass@host:5432/db` | Production DB |
| `SEED_ADMIN_EMAIL` | `admin@procureflow.dev` | - | Admin e-posta |
| `SEED_ADMIN_PASSWORD` | guclu sifre | - | `sync: false` |
| `SECRET_KEY` | guclu secret | - | JWT icin |
| `SMTP_SERVER` | `olimposyapi.com` | - | SMTP host |
| `SMTP_PORT` | `465` | - | TLS port |
| `SMTP_USE_TLS` | `true` | - | TLS acik |
| `SENDER_EMAIL` | `info@olimposyapi.com` | - | Gonderici |
| `SENDER_PASSWORD` | smtp sifresi | - | `sync: false` |

## Setup Adimlari

### Adim 1: PostgreSQL Olustur

1. Render.com Dashboard -> New -> PostgreSQL.
2. DB adi: `procureflow`.
3. Olusan `DATABASE_URL` degerini kopyala.

### Adim 2: Environment Variables Set Et

1. `procureflow-api` servisine gir.
2. Environment -> Environment Variables ac.
3. Asagidaki degerleri gir:

```yaml
SEED_ADMIN_EMAIL=admin@procureflow.dev
SEED_ADMIN_PASSWORD=YOUR_SECURE_PASSWORD_HERE
SECRET_KEY=YOUR_LONG_SECRET_KEY
DATABASE_URL=YOUR_RENDER_POSTGRES_URL
SMTP_SERVER=olimposyapi.com
SMTP_PORT=465
SMTP_USE_TLS=true
SENDER_EMAIL=info@olimposyapi.com
SENDER_PASSWORD=YOUR_SMTP_PASSWORD
```

### Adim 3: Redeploy

1. `procureflow-api` servisinde Redeploy baslat.
2. Build log icinde `python api/seed_admin.py` adimini kontrol et.

## Test Etme

### Login Testi

- Email: `admin@procureflow.dev`
- Password: `SEED_ADMIN_PASSWORD` olarak girdigin deger

```bash
curl -X POST "https://buyerasistans.com.tr/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@procureflow.dev","password":"YOUR_PASSWORD"}'
```

### DB Saglik Testi

```bash
curl "https://buyerasistans.com.tr/api/v1/health/db"
```

Beklenen: `{"database":"ok"}`

## Troubleshooting

### Database not found

- `DATABASE_URL` dogru mu kontrol et.
- Render Postgres servisi ayakta mi kontrol et.

### Admin login olmuyor

- Build loglarda seed adimi calisti mi kontrol et.
- `SEED_ADMIN_EMAIL` ve `SEED_ADMIN_PASSWORD` degerlerini tekrar dogrula.

### 502 Bad Gateway

- Health check path ` /api/v1/health ` mi kontrol et.
- Uvicorn start command dogru mu kontrol et.

## Local DB Senkronizasyonu

```bash
pg_dump procureflow > procureflow_backup.sql
psql "postgresql://user:pass@render-host:5432/procureflow" < procureflow_backup.sql
```

Uyari: Bu islem hedef veritabani verilerini ezebilir.

## Guvenlik Notlari

- `SECRET_KEY` en az 32 karakter olsun.
- Admin sifresini guclu sec.
- `DATABASE_URL` ve SMTP sifresini public paylasma.
