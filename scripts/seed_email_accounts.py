import sys
import os

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from api.database import SessionLocal
from api.models.email_settings import EmailSettings


def seed_email_accounts():
    emails = [
        "notifications@buyerasistans.com.tr",
        "teklif@buyerasistans.com.tr",
        "aksiyon@buyerasistans.com.tr",
        "destek@buyerasistans.com.tr",
        "guvenlik@buyerasistans.com.tr",
        "sozlesme@buyerasistans.com.tr",
        "odeme@buyerasistans.com.tr",
    ]
    password = "96578097Run!!"
    smtp_host = "buyerasistans.com.tr"
    smtp_port = 465
    use_tls = True
    use_ssl = True
    display_name = "ProcureFlow"

    db = SessionLocal()
    for email in emails:
        exists = db.query(EmailSettings).filter_by(email=email).first()
        if not exists:
            acc = EmailSettings(
                email=email,
                password=password,
                smtp_host=smtp_host,
                smtp_port=smtp_port,
                use_tls=use_tls,
                use_ssl=use_ssl,
                enable_email_notifications=True,
                display_name=display_name,
                description=None,
            )
            db.add(acc)
    db.commit()
    db.close()
    print("Email hesapları başarıyla eklendi.")


if __name__ == "__main__":
    seed_email_accounts()
