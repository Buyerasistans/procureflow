# reset_admin_password.py
from sqlalchemy import select
from api.database import SessionLocal
from api.models.user import User  # kritik: doğru model yolu
from api.core.security import get_password_hash

EMAIL = "admin@procureflow.dev"
NEW_PASSWORD = "Admin123!"

print("Script basladi...")

db = SessionLocal()
try:
    print("DB session olustu")
    stmt = select(User).where(User.email == EMAIL)
    user = db.execute(stmt).scalar_one_or_none()
    print("Query calisti")

    if user is None:
        print(f"Kullanici bulunamadi: {EMAIL}")
    else:
        user.hashed_password = get_password_hash(NEW_PASSWORD)
        db.commit()
        print(f"Sifre guncellendi: id={user.id}, email={user.email}")
except Exception as e:
    print("HATA:", repr(e))
    db.rollback()
finally:
    db.close()
    print("Script bitti.")
