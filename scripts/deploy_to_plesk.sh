#!/bin/bash
# Plesk Panel’e Python/Node.js Projesi Otomatik Deploy Scripti
# Gereksinimler: rsync veya scp, ssh erişimi, Plesk’te uygun ortam kurulmuş olmalı

# --- KULLANICI AYARLARI ---
REMOTE_USER="admin"
REMOTE_HOST="213.238.191.177"
REMOTE_PATH="/var/www/vhosts/buyerassistans.com.tr/httpdocs"
LOCAL_PATH="$(pwd)"
PYTHON_ENV_PATH="/var/www/vhosts/buyerassistans.com.tr/venv"

# --- DOSYALARI AKTAR ---
echo "[1/5] Dosyalar aktarılıyor..."
rsync -av --exclude='.venv' --exclude='node_modules' --exclude='.git' $LOCAL_PATH/ $REMOTE_USER@$REMOTE_HOST:$REMOTE_PATH

# --- SSH ile Sunucuya Bağlan ---
echo "[2/5] Sunucuya bağlanılıyor..."
ssh $REMOTE_USER@$REMOTE_HOST << 'ENDSSH'

cd $REMOTE_PATH

# --- Python Bağımlılıklarını Kur ---
echo "[3/5] Python bağımlılıkları yükleniyor..."
if [ -f "requirements.txt" ]; then
  source $PYTHON_ENV_PATH/bin/activate
  pip install -r requirements.txt
fi

# --- Node.js Bağımlılıklarını Kur ve Build Al ---
echo "[4/5] Node.js bağımlılıkları yükleniyor ve build alınıyor..."
if [ -f "web/package.json" ]; then
  cd web
  npm install
  npm run build
  cd ..
fi

# --- Migration’ları Uygula ---
echo "[5/5] Migration’lar uygulanıyor..."
if [ -f "api/alembic.ini" ]; then
  source $PYTHON_ENV_PATH/bin/activate
  cd api
  alembic upgrade head
  cd ..
fi

# --- Sunucu Servisini Yeniden Başlat ---
echo "Uygulama servisi yeniden başlatılıyor..."
# Örneğin gunicorn/uvicorn veya Plesk’in kendi servis yöneticisi kullanılabilir
# systemctl restart myapp.service

ENDSSH

echo "Deploy işlemi tamamlandı!"
