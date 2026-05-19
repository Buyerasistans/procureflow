import smtplib
import ssl
from email.message import EmailMessage
import os
from pathlib import Path

from dotenv import load_dotenv

# Project root'a göre api/.env yükle (process env yoksa)
ROOT_DIR = Path(__file__).resolve().parent
load_dotenv(ROOT_DIR / "api" / ".env")

# .env'den veya doğrudan değişkenlerden alın
SMTP_SERVER = os.getenv("SMTP_SERVER", "buyerasistans.com.tr")
SMTP_PORT = int(os.getenv("SMTP_PORT", 465))
SMTP_USER = os.getenv("SENDER_EMAIL", "notifications@buyerasistans.com.tr")
SMTP_PASSWORD = os.getenv("SENDER_PASSWORD", "96578097Run!!")

TO_EMAIL = SMTP_USER  # Kendinize test maili atın

msg = EmailMessage()
msg["Subject"] = "SMTP Test Maili (Python)"
msg["From"] = SMTP_USER
msg["To"] = TO_EMAIL
msg.set_content("Bu bir test mailidir. SMTP bağlantısı başarılı!")

context = ssl.create_default_context()

print(f"[TEST] SMTP sunucusuna bağlanılıyor: {SMTP_SERVER}:{SMTP_PORT}")
try:
    with smtplib.SMTP_SSL(SMTP_SERVER, SMTP_PORT, context=context) as server:
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("[TEST] Giriş başarılı!")
        server.send_message(msg)
        print(f"[TEST] Test maili gönderildi: {TO_EMAIL}")
except smtplib.SMTPAuthenticationError as e:
    print(f"[HATA] Kimlik doğrulama hatası: {e}")
except Exception as e:
    print(f"[HATA] SMTP bağlantı/gönderim hatası: {e}")
