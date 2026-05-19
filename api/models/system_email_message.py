from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from api.database import Base
from api.core.time import utcnow


class SystemEmailMessage(Base):
    __tablename__ = "system_email_messages"

    id = Column(Integer, primary_key=True, index=True)
    system_email_id = Column(
        Integer, ForeignKey("system_emails.id"), nullable=False, index=True
    )
    direction = Column(String(20), nullable=False, default="inbound")
    message_uid = Column(String(255), nullable=True, index=True)
    external_message_id = Column(String(255), nullable=True, index=True)
    status = Column(String(50), nullable=False, default="received")
    subject = Column(String(500), nullable=True)
    from_email = Column(String(255), nullable=True)
    to_email = Column(String(255), nullable=True)
    cc_email = Column(String(500), nullable=True)
    snippet = Column(Text, nullable=True)
    body_text = Column(Text, nullable=True)
    body_html = Column(Text, nullable=True)
    attachments_json = Column(Text, nullable=True)
    thread_key = Column(String(255), nullable=True, index=True)
    in_reply_to = Column(String(255), nullable=True)
    references_header = Column(Text, nullable=True)
    is_read = Column(Boolean, nullable=False, default=False)
    is_starred = Column(Boolean, nullable=False, default=False)
    is_important = Column(Boolean, nullable=False, default=False)
    received_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=utcnow)
    updated_at = Column(
        DateTime(timezone=True), nullable=False, default=utcnow, onupdate=utcnow
    )

    system_email = relationship("SystemEmail", back_populates="messages")
