#!/usr/bin/env python
"""
Super Admin kullanıcısı oluştur
"""

import os
import sys

# Add the project root to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment
from dotenv import load_dotenv

load_dotenv()

# Now import modules
from sqlalchemy import create_engine, or_
from sqlalchemy.orm import sessionmaker
from core.security import get_password_hash
from models.user import User
from core.config import DATABASE_URL

# Veritabanı bağlantısı oluştur
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Session oluştur
db = SessionLocal()

try:
    # Mevcut super_admin'i kontrol et
    existing_admin = (
        db.query(User)
        .filter(or_(User.system_role == "super_admin", User.role == "super_admin"))
        .first()
    )
    if existing_admin:
        print(f"⚠️  Super Admin zaten var: {existing_admin.email}")
        sys.exit(0)

    # Yeni super_admin oluştur
    super_admin = User(
        email="superadmin@procureflow.com",
        full_name="Super Admin",
        hashed_password=get_password_hash("superadmin123"),
        role="super_admin",
        system_role="super_admin",
        approval_limit=999999999,  # Sınırsız onay limiti
        is_active=True,
    )

    db.add(super_admin)
    db.commit()
    db.refresh(super_admin)

    print("✅ Super Admin başarıyla oluşturuldu!")
    print(f"Email: {super_admin.email}")
    print(f"Şifre: superadmin123")
    print(f"Role: {super_admin.role}")
    print(f"System Role: {super_admin.system_role}")
    print()
    print("İçeri girmek için bu bilgilerini kullan:")
    print("  Email: superadmin@procureflow.com")
    print("  Şifre: superadmin123")

except Exception as e:
    print(f"[ERROR] Hata: {e}")
    db.rollback()
    sys.exit(1)
finally:
    db.close()
