from pydantic import BaseModel, ConfigDict


class SystemEmailSchema(BaseModel):
    id: int | None = None
    email: str
    password: str
    owner_user_id: int | None = None
    description: str | None = None
    signature_name: str | None = None
    signature_title: str | None = None
    signature_note: str | None = None
    signature_image_url: str | None = None
    is_active: bool = True
    imap_host: str | None = None
    imap_port: int | None = None
    imap_username: str | None = None
    imap_password: str | None = None
    imap_use_ssl: bool = True
    mailbox_folder: str | None = "INBOX"
    last_inbox_sync_at: str | None = None
    last_inbox_error: str | None = None
    mailbox_provision_status: str | None = None
    mailbox_provision_message: str | None = None
    mailbox_provisioned_at: str | None = None

    model_config = ConfigDict(from_attributes=True)


class SystemEmailCreate(BaseModel):
    email: str
    password: str = ""
    owner_user_id: int | None = None
    description: str | None = None
    signature_name: str | None = None
    signature_title: str | None = None
    signature_note: str | None = None
    signature_image_url: str | None = None
    is_active: bool = True
    imap_host: str | None = None
    imap_port: int | None = None
    imap_username: str | None = None
    imap_password: str | None = None
    imap_use_ssl: bool = True
    mailbox_folder: str | None = "INBOX"


class SystemEmailUpdate(BaseModel):
    password: str | None = None
    description: str | None = None
    signature_name: str | None = None
    signature_title: str | None = None
    signature_note: str | None = None
    signature_image_url: str | None = None
    is_active: bool | None = None
    imap_host: str | None = None
    imap_port: int | None = None
    imap_username: str | None = None
    imap_password: str | None = None
    imap_use_ssl: bool | None = None
    mailbox_folder: str | None = None


class SystemEmailMessageSchema(BaseModel):
    id: int
    system_email_id: int
    direction: str
    message_uid: str | None = None
    external_message_id: str | None = None
    status: str
    subject: str | None = None
    from_email: str | None = None
    to_email: str | None = None
    cc_email: str | None = None
    snippet: str | None = None
    body_text: str | None = None
    is_read: bool = False
    received_at: str | None = None
    sent_at: str | None = None
    created_at: str | None = None

    model_config = ConfigDict(from_attributes=True)
