from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from api.models.system_email import SystemEmail
from api.models.email_settings import EmailSettings
from api.schemas.system_email import SystemEmailSchema
from api.database import get_db
from api.core.authz import (
    can_access_procurement_settings,
    can_access_quote_workspace,
    is_super_admin,
)
from api.core.deps import get_current_user
from api.models.user import User
from api.core.time import utcnow
from api.services.mailbox_provisioning_service import provision_mailbox

router = APIRouter(prefix="/system-emails", tags=["system-emails"])


def _ensure_admin(current_user: User) -> User:
    if not (
        can_access_procurement_settings(current_user)
        or can_access_quote_workspace(current_user)
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Admin yetkisi gerekli"
        )
    return current_user


def _resolve_owner_scope(
    current_user: User, owner_user_id: int | None = None
) -> int | None:
    if is_super_admin(current_user):
        return owner_user_id
    return current_user.id


def _build_mailbox_seed_password(email_address: str) -> str:
    local = str(email_address or "").split("@", 1)[0].strip() or "mailbox"
    return f"{local}!seed#2026"


@router.get("/", response_model=List[SystemEmailSchema])
def list_system_emails(
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)

    query = db.query(SystemEmail)
    if is_super_admin(current_user) and owner_user_id is None:
        return (
            query.filter(SystemEmail.is_active.is_(True))
            .order_by(SystemEmail.id.asc())
            .all()
        )

    resolved_owner = _resolve_owner_scope(current_user, owner_user_id)
    if resolved_owner is None:
        query = query.filter(SystemEmail.owner_user_id.is_(None))
    else:
        query = query.filter(SystemEmail.owner_user_id == resolved_owner)
    return query.order_by(SystemEmail.id.asc()).all()


# Slashsiz endpoint desteği
@router.get("", response_model=List[SystemEmailSchema])
def list_system_emails_no_slash(
    owner_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return list_system_emails(owner_user_id, current_user, db)


from api.schemas.system_email import SystemEmailCreate, SystemEmailUpdate


@router.post("/", response_model=SystemEmailSchema)
def add_system_email(
    email: SystemEmailCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)
    if db.query(SystemEmail).filter_by(email=email.email).first():
        raise HTTPException(status_code=400, detail="Bu email zaten kayıtlı.")
    resolved_owner = _resolve_owner_scope(current_user, email.owner_user_id)
    settings = (
        db.query(EmailSettings)
        .filter(EmailSettings.owner_user_id == resolved_owner)
        .first()
    )
    if settings is None and resolved_owner is not None:
        settings = (
            db.query(EmailSettings)
            .filter(EmailSettings.owner_user_id.is_(None))
            .first()
        )
    requested_password = (email.password or "").strip()
    provisioning_input_password = requested_password or _build_mailbox_seed_password(
        email.email
    )
    provisioning_result = provision_mailbox(
        settings, email.email, provisioning_input_password
    )
    effective_password = (
        provisioning_result.effective_password
        or requested_password
        or provisioning_input_password
    )
    effective_imap_password = (email.imap_password or "").strip() or effective_password
    obj = SystemEmail(
        email=email.email,
        password=effective_password,
        owner_user_id=resolved_owner,
        description=email.description,
        signature_name=email.signature_name,
        signature_title=email.signature_title,
        signature_note=email.signature_note,
        signature_image_url=email.signature_image_url,
        is_active=email.is_active,
        imap_host=email.imap_host,
        imap_port=email.imap_port,
        imap_username=email.imap_username,
        imap_password=effective_imap_password,
        imap_use_ssl=email.imap_use_ssl,
        mailbox_folder=email.mailbox_folder,
        mailbox_provision_status=provisioning_result.status,
        mailbox_provision_message=provisioning_result.message,
        mailbox_provisioned_at=utcnow().isoformat()
        if provisioning_result.status == "provisioned"
        else None,
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("", response_model=SystemEmailSchema)
def add_system_email_no_slash(
    email: SystemEmailCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return add_system_email(email, current_user, db)


@router.put("/{email_id}", response_model=SystemEmailSchema)
def update_system_email(
    email_id: int,
    update: SystemEmailUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)
    obj = db.query(SystemEmail).filter_by(id=email_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Email bulunamadı.")
    resolved_owner = _resolve_owner_scope(current_user, obj.owner_user_id)
    if obj.owner_user_id != resolved_owner:
        raise HTTPException(
            status_code=403, detail="Bu email hesabını düzenleme yetkiniz yok"
        )
    # Sadece gönderilen alanları güncelle
    old_password = (obj.password or "").strip()
    old_imap_password = (obj.imap_password or "").strip()
    incoming_password = (
        update.password.strip() if isinstance(update.password, str) else None
    )
    if incoming_password is not None:
        obj.password = incoming_password
        if update.imap_password is None and (
            not old_imap_password or old_imap_password == old_password
        ):
            obj.imap_password = incoming_password
    if update.description is not None:
        obj.description = update.description
    if update.signature_name is not None:
        obj.signature_name = update.signature_name
    if update.signature_title is not None:
        obj.signature_title = update.signature_title
    if update.signature_note is not None:
        obj.signature_note = update.signature_note
    if update.signature_image_url is not None:
        obj.signature_image_url = update.signature_image_url
    if update.is_active is not None:
        obj.is_active = update.is_active
    if update.imap_host is not None:
        obj.imap_host = update.imap_host
    if update.imap_port is not None:
        obj.imap_port = update.imap_port
    if update.imap_username is not None:
        obj.imap_username = update.imap_username
    if update.imap_password is not None:
        obj.imap_password = update.imap_password
    if update.imap_use_ssl is not None:
        obj.imap_use_ssl = update.imap_use_ssl
    if update.mailbox_folder is not None:
        obj.mailbox_folder = update.mailbox_folder
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/{email_id}/provision", response_model=SystemEmailSchema)
def provision_existing_system_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)
    obj = db.query(SystemEmail).filter_by(id=email_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Email bulunamadı.")
    resolved_owner = _resolve_owner_scope(current_user, obj.owner_user_id)
    if obj.owner_user_id != resolved_owner:
        raise HTTPException(
            status_code=403, detail="Bu email hesabını hostingte açma yetkiniz yok"
        )

    settings = (
        db.query(EmailSettings)
        .filter(EmailSettings.owner_user_id == resolved_owner)
        .first()
    )
    if settings is None and resolved_owner is not None:
        settings = (
            db.query(EmailSettings)
            .filter(EmailSettings.owner_user_id.is_(None))
            .first()
        )

    previous_password = (obj.password or "").strip()
    previous_imap_password = (obj.imap_password or "").strip()
    provisioning_result = provision_mailbox(
        settings, obj.email, obj.password, force=True
    )
    if (
        provisioning_result.status == "provisioned"
        and provisioning_result.effective_password
    ):
        obj.password = provisioning_result.effective_password
        if not previous_imap_password or previous_imap_password == previous_password:
            obj.imap_password = provisioning_result.effective_password
    obj.mailbox_provision_status = provisioning_result.status
    obj.mailbox_provision_message = provisioning_result.message
    obj.mailbox_provisioned_at = (
        utcnow().isoformat() if provisioning_result.status == "provisioned" else None
    )
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{email_id}")
def delete_system_email(
    email_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _ensure_admin(current_user)
    obj = db.query(SystemEmail).filter_by(id=email_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="Email bulunamadı.")
    resolved_owner = _resolve_owner_scope(current_user, obj.owner_user_id)
    if obj.owner_user_id != resolved_owner:
        raise HTTPException(
            status_code=403, detail="Bu email hesabını silme yetkiniz yok"
        )
    db.delete(obj)
    db.commit()
    return {"ok": True}
