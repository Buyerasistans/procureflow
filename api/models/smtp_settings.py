from sqlalchemy import Column, Integer, String, Boolean
from sqlalchemy.ext.declarative import declarative_base

from api.database import Base


class SmtpSettings(Base):
    __tablename__ = "smtp_settings"

    id = Column(Integer, primary_key=True, index=True)
    smtp_host = Column(String(255), nullable=False, default="")
    smtp_port = Column(Integer, nullable=False, default=587)
    smtp_username = Column(String(255), nullable=True, default="")
    smtp_password = Column(String(255), nullable=True, default="")
    from_email = Column(String(255), nullable=False, default="noreply@procureflow.com")
    from_name = Column(String(255), nullable=False, default="ProcureFlow")
    use_tls = Column(Boolean, nullable=False, default=True)
    use_ssl = Column(Boolean, nullable=False, default=False)
    enable_email_notifications = Column(Boolean, nullable=False, default=False)
    # Opsiyonel: updated_at, updated_by_id gibi alanlar eklenebilir
