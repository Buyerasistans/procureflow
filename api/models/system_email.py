from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from api.database import Base


class SystemEmail(Base):
    __tablename__ = "system_emails"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True, index=True)
    owner_user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    description = Column(Text, nullable=True)  # Kullanım amacı
    signature_name = Column(String(255), nullable=True)
    signature_title = Column(String(255), nullable=True)
    signature_note = Column(Text, nullable=True)
    signature_image_url = Column(String(500), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    imap_host = Column(String(255), nullable=True)
    imap_port = Column(Integer, nullable=True)
    imap_username = Column(String(255), nullable=True)
    imap_password = Column(String(255), nullable=True)
    imap_use_ssl = Column(Boolean, nullable=False, default=True)
    mailbox_folder = Column(String(255), nullable=True, default="INBOX")
    last_inbox_sync_at = Column(String(64), nullable=True)
    last_inbox_error = Column(Text, nullable=True)
    mailbox_provision_status = Column(String(32), nullable=False, default="pending")
    mailbox_provision_message = Column(Text, nullable=True)
    mailbox_provisioned_at = Column(String(64), nullable=True)

    tenant = relationship("Tenant", back_populates="system_emails")
    messages = relationship(
        "SystemEmailMessage",
        back_populates="system_email",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<SystemEmail(email={self.email})>"
