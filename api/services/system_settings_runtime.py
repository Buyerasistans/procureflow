from __future__ import annotations

from sqlalchemy.orm import Session

from api.models.settings import SystemSettings


def get_or_create_system_settings(db: Session) -> SystemSettings:
    settings = db.query(SystemSettings).first()
    if not settings:
        settings = SystemSettings(app_name="ProcureFlow")
        db.add(settings)
        db.commit()
        db.refresh(settings)
    return settings
