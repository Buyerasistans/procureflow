# Hostinge Yükleme Kılavuzu - Procureflow

**Son Güncelleme:** 2 Mayıs 2026

---

## 📋 Yüklemesi Gereken Dosya Listesi

### 1. API Klasörü (`api/`)

``

api/
├── main.py                          ✓ ZORUNLU (uygulama başlatıcı)
├── database.py                      ✓ ZORUNLU (veritabanı bağlantısı)
├── dependencies.py                  ✓ ZORUNLU (bağımlılıklar)
├── schemas.py                       ✓ ZORUNLU (API şemaları)
├── requirements.txt                 ✓ ZORUNLU (Python paketleri)
├── requirements-lock.txt            ✓ TAVSIYE (locked versiyonlar)
├── .env.example                     ✓ REFERANS (ortam değişkenleri örneği)
├── alembic/                         ✓ ZORUNLU (veritabanı migrasyonları)
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── alembic.ini                      ✓ ZORUNLU
│
├── app/                             ✓ ZORUNLU
│   ├── _init_.py
│   ├── models/
│   ├── schemas/
│   └── routers/
│
├── core/                            ✓ ZORUNLU
│   ├── _init_.py
│   ├── config.py                    (kurumsal yapılandırma)
│   ├── security.py
│   └── settings.py
│
├── db/                              ✓ ZORUNLU
│   ├── _init_.py
│   ├── session.py
│   └── models.py
│
├── models/                          ✓ ZORUNLU
│   ├── _init_.py
│   ├── user.py
│   ├── organization.py
│   ├── role.py
│   ├── permission.py
│   ├── department.py
│   ├── job.py
│   ├── quote.py
│   └── (tüm model dosyaları)
│
├── routers/                         ✓ ZORUNLU
│   ├── _init_.py
│   ├── users.py
│   ├── auth.py
│   ├── organizations.py
│   ├── roles.py
│   ├── departments.py
│   ├── jobs.py
│   ├── quotes.py
│   ├── ai_lab.py                    ✓ CAD/DWG desteği için
│   └── (tüm router dosyaları)
│
├── schemas/                         ✓ ZORUNLU
│   ├── _init_.py
│   └── (tüm schema dosyaları)
│
├── services/                        ✓ ZORUNLU
│   ├── _init_.py
│   ├── extractor.py                 ✓ CAD metadata çıkarıcı
│   ├── cad_convert.py               ✓ DWG->DXF dönüştürücü
│   └── (tüm service dosyaları)
│
├── utils/                           ✓ ZORUNLU
│   ├── _init_.py
│   └── (tüm utility dosyaları)
│
├── scripts/                         ✓ TAVSIYE (yönetim scriptleri)
│   ├── validate_runtime_bootstrap_chain.py
│   ├── audit_quote_mirror_drop_readiness.py
│   ├── drop_quote_legacy_mirror_columns.py
│   └── (yönetim scriptleri)
│
├── uploads/                         ✓ GEREKLI (boş klasör, dosya uploadu için)
│
└── .venv/                          ✗ KOPYALAMA (hostta yeniden kurulacak)

``

---

### 2. Web Klasörü (`web/`)

``

web/
├── package.json                     ✓ ZORUNLU
├── package-lock.json                ✓ ZORUNLU
├── vite.config.ts                   ✓ ZORUNLU
├── tsconfig.json                    ✓ ZORUNLU
├── tsconfig.app.json                ✓ ZORUNLU
├── tsconfig.node.json               ✓ ZORUNLU
├── tailwind.config.js               ✓ TAVSIYE (stil yapılandırması)
├── postcss.config.js                ✓ TAVSIYE
├── eslint.config.js                 ✓ TAVSIYE
├── index.html                       ✓ ZORUNLU
│
├── .env                             ✓ GEREKLI (yerel geliştirme)
├── .env.production                  ✓ ZORUNLU (hosting ortamı)
│
├── src/                             ✓ ZORUNLU
│   ├── main.tsx                     (entry point)
│   ├── App.tsx
│   ├── index.css
│   ├── api/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── context/
│   ├── types/
│   ├── utils/
│   └── (tüm React dosyaları)
│
├── public/                          ✓ ZORUNLU
│   ├── favicon.ico
│   └── (logo, statik kaynaklar)
│
├── dist/                            ✗ KOPYALAMA (hostta `npm run build` ile oluşturulacak)
├── node_modules/                    ✗ KOPYALAMA (hostta `npm install` ile kurulacak)
└── uploads/                         ✓ GEREKLI (boş klasör, dosya uploadu için)

``

---

### 3. Proje Kök Dosyaları

``
procureflow/ (PROJE KÖKİ)
├── README.md                        ✓ TAVSIYE (dokumentasyon)
├── ARCHITECTURE.md                  ✓ TAVSIYE
├── .env.example                     ✓ REFERANS (ortam değişkenleri)
├── .gitignore                       ✗ OPTIONAL
├── .git/                            ✗ OPTIONAL (Git tarihi gerekmez)
│
├── alembic/                         ✓ ZORUNLU (migrasyon scriptleri)
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── alembic.ini                      ✓ ZORUNLU
│
├── migrations/                      ✓ OPTIONAL (eğer varsa,
veritabanı başlangıç scriptleri)
│
├── scripts/                         ✓ TAVSIYE (yönetim scriptleri)
│   ├── validate_runtime_bootstrap_chain.py
│   ├── audit_quote_mirror_drop_readiness.py
│   └── (diğer yönetim scriptleri)
│
└── tests/                           ✗ OPTIONAL (üretim ortamında gerekmez)
``

---

## 🚀 Adım Adım Yükleme Talimatları

### ADIM 1: Hosting Sunucusuna Bağlan

```powershell
# Windows sunucuya RDP veya Remote Desktop ile bağlan
# veya SSH ile Linux sunucuya bağlan
```

### ADIM 2: Proje Klasörünü Oluştur

```powershell
# Windows
mkdir C:\fiye\procureflow
cd C:\fiye\procureflow

# Linux/Mac
mkdir -p /opt/fiye/procureflow
cd /opt/fiye/procureflow
```

### ADIM 3: Yukarıdaki Dosyaları Kopyala

Lokal makinendan `d:\Projects\procureflow` içindeki **tüm dosyaları**
(`.venv` ve `node_modules` hariç) hosting sunucusuna kopyala.

**Windows (PowerShell):**

```powershell
# Lokaldeki proje klasörünü hosting sunucusuna kopyala
Copy-Item -Path "d:\Projects\procureflow\*" -Destination 
"C:\fiye\procureflow\" -Recurse -Force
```

**Linux (SCP):**

```bash
scp -r d:\Projects\procureflow/* user@host:/opt/fiye/procureflow/
```

### ADIM 4: `.env` Dosyasını Oluştur (API)

`C:\fiye\procureflow\api\.env` adında yeni dosya oluştur:

```env
# Veritabanı Konfigürasyonu
DATABASE_URL=postgresql://user:password@localhost:5432/procureflow_db
# veya MySQL:
# DATABASE_URL=mysql+pymysql://user:password@localhost:3306/procureflow_db

# Uygulama Ayarları
APP_NAME=ProcureFlow
APP_PORT=8000
APP_URL=https://yourdomain.com

# JWT/Güvenlik
SECRET_KEY=your-super-secret-key-here-change-this
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Email (opsiyonel)
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password

# DWG -> DXF Dönüştürücü
# Option 1: Direkt yol (Windows)
DWG_TO_DXF_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter.exe

# Option 2: PATH'te varsa boş bırak
# DWG_TO_DXF_CONVERTER_PATH=

# Option 3: TeighaFileConverter
# DWG_TO_DXF_CONVERTER_PATH=C:\Program Files\Teigha File Converter\TeighaFileConverter.exe

# AI Lab API (opsiyonel)
OPENAI_API_KEY=sk-your-openai-key

# Logging
LOG_LEVEL=INFO
```

### ADIM 5: `.env.production` Dosyasını Oluştur (Frontend)

`C:\fiye\procureflow\web\.env.production` adında yeni dosya oluştur:

```env
VITE_API_BASE_URL=https://yourdomain.com:8000
VITE_API_TIMEOUT=30000
VITE_APP_NAME=ProcureFlow
VITE_ENVIRONMENT=production
```

### ADIM 6: Python Sanal Ortamını Kur

```powershell
# Windows
cd C:\fiye\procureflow\api
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

# Linux
cd /opt/fiye/procureflow/api
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

### ADIM 7: Node.js Paketlerini Kur

```powershell
# Windows
cd C:\fiye\procureflow\web
npm install

# Linux
cd /opt/fiye/procureflow/web
npm install
```

### ADIM 8: Veritabanını Başlat

```powershell
# PostgreSQL/MySQL sunucusu çalışıyor olmalı
cd C:\fiye\procureflow\api
.\.venv\Scripts\Activate.ps1

# Migrasyonları çalıştır
alembic upgrade head

# (Opsiyonel) Test verileri ekle
python seed_admin.py
```

### ADIM 9: DWG -> DXF Dönüştürücü Kur

Hostta DWG dosyalarını desteklemek için converter yükle:

**Windows - ODAFileConverter:**

1. [https://www.opendesign.com/guestfiles/ODAFileConverter_28_2_6_x64.msi
(https://www.opendesign.com/guestfiles/ODAFileConverter_28_2_6_x64.msi) indir
2. `C:\Program Files\ODA\` altında yükle
3. `.env` dosyasında yol belirt:

   ```env
   DWG_TO_DXF_CONVERTER_PATH=C:\Program Files\ODA\ODAFileConverter.exe
   ```

**Linux - LibreCAD/DwgConvert:**

```bash
sudo apt-get install libcad
# veya ODA converter
```

### ADIM 10: Backend'i Başlat

```powershell
# Windows
cd C:\fiye\procureflow\api
.\.venv\Scripts\Activate.ps1
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn api.main:app --host 0.0.0.0 --port 8000

# Veya hazırladığımız scripti kullanın:
# .\start-api.ps1

# Linux (systemd service olarak)
# /etc/systemd/system/procureflow-api.service oluştur (aşağıya bak)
```

### ADIM 11: Frontend'i Build Et

```powershell
cd C:\fiye\procureflow\web
npm run build
```

### ADIM 12: Frontend'i Serve Et

**Option 1: Node.js Preview Sunucusu

```powershell
npm run preview -- --host 0.0.0.0 --port 4173
```

**Option 2: Nginx Statik Sunucu (tavsiye)

- `C:\fiye\procureflow\web\dist` klasörünü Nginx'e işaret ettir
- Nginx config:

  ```nginx
  server {
    listen 80;
    server_name yourdomain.com;
    
    root C:\fiye\procureflow\web\dist;
    index index.html;
    
    location / {
      try_files $uri $uri/ /index.html;
    }
    
    location /api/ {
      proxy_pass http://127.0.0.1:8000;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
    }
  }
  ```

---

## 🔧 Hostinge Hazırlanma Kontrol Listesi

- [ ] Proje klasörü oluşturuldu: `C:\fiye\procureflow`
- [ ] **api/** klasörü kopyalandı
- [ ] **web/** klasörü kopyalandı
- [ ] **alembic/** klasörü kopyalandı
- [ ] **scripts/** klasörü kopyalandı (opsiyonel)
- [ ] `requirements.txt` kopyalandı
- [ ] `package.json` ve `package-lock.json` kopyalandı
- [ ] `README.md` ve `ARCHITECTURE.md` kopyalandı
- [ ] `.env` dosyası oluşturuldu (api/)
- [ ] `.env.production` dosyası oluşturuldu (web/)
- [ ] Python `.venv` kuruldu
- [ ] `pip install -r requirements.txt` çalıştırıldı
- [ ] Node.js `npm install` çalıştırıldı
- [ ] Veritabanı bağlantısı test edildi
- [ ] DWG->DXF converter yüklendi ve `.env`'e yol yazıldı
- [ ] Backend başlatıldı ve çalışıyor
- [ ] Frontend build edildi
- [ ] Frontend serve ediliyor
- [ ] https/SSL sertifikası yapılandırıldı (production)
- [ ] Firewall kuralları ayarlandı
- [ ] Backups/logs dizinleri hazırlandı

---

## 📂 Son Klasör Yapısı (Hosting)

``
C:\fiye\procureflow\
├── api/
│   ├── .venv/                   (kuruldu)
│   ├── .env                     (oluşturuldu)
│   ├── alembic/
│   ├── main.py
│   ├── requirements.txt
│   └── (tüm api dosyaları)
│
├── web/
│   ├── node_modules/            (kuruldu)
│   ├── dist/                    (build edildi)
│   ├── .env.production          (oluşturuldu)
│   ├── package.json
│   └── (tüm web dosyaları)
│
├── alembic/
├── scripts/
├── README.md
├── ARCHITECTURE.md
├── .env.example
└── uploads/                     (API ve Web uploads)
``

---

## ⚠️ Önemli Notlar

### DWG Dosyaları İçin

- **Hostta converter varsa:** DWG dosyaları otomatik olarak DXF'e çevrilir
- **Converter yoksa:** DXF dosyaları kullanabilirsin
- Converter `ODAFileConverter.exe` veya `TeighaFileConverter` olabilir

### Veritabanı

- PostgreSQL tavsiye edilir (daha güçlü)
- MySQL de desteklenir
- Veritabanı sunucusu hostta veya network'de olabilir

### Güvenlik

- `.env` dosyasını **git push etme**
- `SECRET_KEY` güçlü bir değerle değiştir
- HTTPS/SSL certificate ekle
- Firewall kurallarını konfigure et

### Performance

- API'yi production mode'da çalıştır: `gunicorn` kullan
- Frontend'i Nginx arkasında serve et
- Redis cache ekle (opsiyonel)

---

## 🆘 Sorun Giderme

### ImportError: No module named 'routers'

```powershell
# Sanal ortamı aktifleştir
.\.venv\Scripts\Activate.ps1
# Paketleri yeniden kur
pip install -r requirements.txt
```

### DWG dosyası dönüştürülemiyor

```powershell
# Converter'ı test et
C:\Program Files\ODA\ODAFileConverter.exe -? 
# Veya PATH'e ekle
[Environment]::SetEnvironmentVariable
("Path", $env:Path + ";C:\Program Files\ODA\", "User")
```

### Port 8000 zaten kullanılıyor

```powershell
# Başka bir port kullan
.\.venv\Scripts\python.exe -m uvicorn api.main:app --port 8001 --host 0.0.0.0
```

---

## 📞 İletişim & Destek

Eğer hostinge yükleme sırasında sorun yaşarsan,
bu dosyaya referans ver ve sorununu açıkla.

**Son Güncelleme:** 2 Mayıs 2026
