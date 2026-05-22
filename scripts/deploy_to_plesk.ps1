# Plesk Panel’e Python/Node.js Projesi Otomatik Deploy PowerShell Scripti
# Gereksinimler: WinSCP, PuTTY/Plink veya benzeri araçlar, SSH erişimi

$remoteUser = "admin"
$remoteHost = "213.238.191.177"
$remotePath = "/var/www/vhosts/buyerassistans.com.tr/httpdocs"
$localPath = (Get-Location).Path
$pythonEnvPath = "/var/www/vhosts/buyerassistans.com.tr/venv"

# --- Dosyaları Aktar ---
Write-Host "[1/5] Dosyalar aktarılıyor..."
scp -r -q -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -i "path_to_private_key" $localPath/* $remoteUser@$remoteHost:$remotePath

# --- SSH ile Sunucuya Bağlan ve Komutları Çalıştır ---
Write-Host "[2/5] Sunucuya bağlanılıyor ve işlemler başlatılıyor..."
$commands = @"
cd $remotePath

# Python bağımlılıkları
if [ -f "requirements.txt" ]; then
  source $pythonEnvPath/bin/activate
  pip install -r requirements.txt
fi

# Node.js bağımlılıkları ve build
if [ -f "web/package.json" ]; then
  cd web
  npm install
  npm run build
  cd ..
fi

# Migration’lar
if [ -f "api/alembic.ini" ]; then
  source $pythonEnvPath/bin/activate
  cd api
  alembic upgrade head
  cd ..
fi

# Servis restart (örnek)
# systemctl restart myapp.service
"@

plink -ssh $remoteUser@$remoteHost -pw "96578097Run!!" $commands

Write-Host "Deploy işlemi tamamlandı!"
