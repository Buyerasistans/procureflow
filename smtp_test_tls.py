import smtplib
import ssl
from email.message import EmailMessage
import os

# .env'den veya doğrudan değişkenlerden alın
SMTP_SERVER = os.getenv("SMTP_SERVER", "buyerasistans.com.tr")
SMTP_PORT = int(os.getenv("SMTP_PORT", 587))  # TLS için 587
SMTP_USER = os.getenv("SENDER_EMAIL", "notifications@buyerasistans.com.tr")
SMTP_PASSWORD = os.getenv("SENDER_PASSWORD", "96578097Run!!")

TO_EMAIL = SMTP_USER  # Kendinize test maili atın

msg = EmailMessage()
msg["Subject"] = "SMTP TLS Test Maili (Python)"
msg["From"] = SMTP_USER
msg["To"] = TO_EMAIL
msg.set_content("Bu bir test mailidir. SMTP TLS bağlantısı başarılı!")

context = ssl.create_default_context()

print(f"[TEST] SMTP sunucusuna bağlanılıyor (TLS): {SMTP_SERVER}:{SMTP_PORT}")
try:
    with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
        server.ehlo()
        server.starttls(context=context)
        server.ehlo()
        server.login(SMTP_USER, SMTP_PASSWORD)
        print("[TEST] Giriş başarılı!")
        server.send_message(msg)
        print(f"[TEST] Test maili gönderildi: {TO_EMAIL}")
except smtplib.SMTPAuthenticationError as e:
    print(f"[HATA] Kimlik doğrulama hatası: {e}")
except Exception as e:
    print(f"[HATA] SMTP bağlantı/gönderim hatası: {e}")
