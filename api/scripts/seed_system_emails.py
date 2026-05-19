"""
Sistem mail adreslerini ve açıklamalarını toplu ekler.
"""

from api.database import SessionLocal
from api.models.system_email import SystemEmail

SYSTEM_EMAILS = [
    (
        "notifications@buyerasistans.com.tr",
        "",
        "Sistem bildirimleri, genel e-posta trafiği",
    ),
    ("teklif@buyerasistans.com.tr", "", "Teklif gönderimleri ve teklif yanıtları"),
    (
        "aksiyon@buyerasistans.com.tr",
        "",
        "Onay, reddetme, işlem gerektiren bildirimler",
    ),
    ("destek@buyerasistans.com.tr", "", "Destek talepleri ve müşteri iletişimi"),
    ("guvenlik@buyerasistans.com.tr", "", "Güvenlik uyarıları, parola sıfırlama"),
    ("sozlesme@buyerasistans.com.tr", "", "Sözleşme gönderimi ve takibi"),
    ("odeme@buyerasistans.com.tr", "", "Fatura, ödeme ve tahsilat işlemleri"),
]


def seed():
    db = SessionLocal()
    for email, password, description in SYSTEM_EMAILS:
        if not db.query(SystemEmail).filter_by(email=email).first():
            obj = SystemEmail(email=email, password=password, description=description)
            db.add(obj)
    db.commit()
    db.close()
    print("Sistem mail adresleri eklendi.")


if __name__ == "__main__":
    seed()
