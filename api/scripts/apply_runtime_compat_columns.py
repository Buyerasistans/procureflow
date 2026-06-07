from __future__ import annotations

import sys
from pathlib import Path

from sqlalchemy import text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import api.models  # noqa: F401
from api.database import Base, engine
from api.db.session import SessionLocal


STATEMENTS = [
    # Company / user profil ve davet alanlari
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS logo_url VARCHAR(500)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS trade_name VARCHAR(200)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_office VARCHAR(255)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS tax_number VARCHAR(32)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS registration_number VARCHAR(64)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS address_district VARCHAR(100)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS contact_info VARCHAR(500)",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS hide_location BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS share_on_whatsapp BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE companies ADD COLUMN IF NOT EXISTS mailbox_team_visibility_enabled BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS photo TEXT",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS work_email VARCHAR(255)",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS work_email VARCHAR(255)",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS photo TEXT",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS address_district VARCHAR(100)",
    "ALTER TABLE supplier_users ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS personal_phone VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_phone VARCHAR(32)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS company_phone_short VARCHAR(16)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS address VARCHAR(500)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS hide_location BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS share_on_whatsapp BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS hidden_from_admin BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_original_email VARCHAR(255)",
    "CREATE INDEX IF NOT EXISTS ix_users_work_email ON users(work_email)",
    "CREATE INDEX IF NOT EXISTS ix_supplier_users_work_email ON supplier_users(work_email)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token VARCHAR(255)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_token_expires TIMESTAMP",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS invitation_accepted BOOLEAN DEFAULT FALSE NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_invitation_token ON users(invitation_token)",
    # Tenant scope UI ve destek workflow alanlari
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS scope_type VARCHAR(20)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role_profile_code VARCHAR(100)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_status VARCHAR(50) DEFAULT 'new' NOT NULL",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_payment_status VARCHAR(50) DEFAULT 'not_required' NOT NULL",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_payment_method VARCHAR(50)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_payment_reference_id INTEGER",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_payment_verified_at TIMESTAMP",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_approval_status VARCHAR(50) DEFAULT 'not_required' NOT NULL",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_rejected_at TIMESTAMP",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_rejected_by_user_id INTEGER",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_approved_at TIMESTAMP",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_approved_by_user_id INTEGER",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_activation_notes TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_tracking_token VARCHAR(255)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_tracking_expires_at TIMESTAMP",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS onboarding_decision_timeline_json TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category VARCHAR(255)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category_tags_json TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS target_category_tags_json TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS category_requests_json TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_owner_name VARCHAR(255)",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_notes TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_resolution_reason TEXT",
    "ALTER TABLE tenants ADD COLUMN IF NOT EXISTS support_last_contacted_at TIMESTAMP",
    "CREATE INDEX IF NOT EXISTS ix_tenants_onboarding_payment_reference_id ON tenants(onboarding_payment_reference_id)",
    "CREATE INDEX IF NOT EXISTS ix_tenants_onboarding_approved_by_user_id ON tenants(onboarding_approved_by_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_tenants_onboarding_rejected_by_user_id ON tenants(onboarding_rejected_by_user_id)",
    "CREATE INDEX IF NOT EXISTS ix_tenants_onboarding_tracking_token ON tenants(onboarding_tracking_token)",
    "ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_file_url VARCHAR(500)",
    "ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS receipt_original_filename VARCHAR(255)",
    "ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS buyer_note TEXT",
    "ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP",
    "ALTER TABLE commercial_requests ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255)",
    "ALTER TABLE commercial_requests ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMP",
    "CREATE INDEX IF NOT EXISTS ix_commercial_requests_owner_name ON commercial_requests(owner_name)",
    "ALTER TABLE tenant_subscription_addons ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP",
    "ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS platform_primary_company_id INTEGER",
    "ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS commercial_request_webhook_url TEXT",
    "ALTER TABLE system_settings ADD COLUMN IF NOT EXISTS commercial_request_webhook_secret TEXT",
    "ALTER TABLE company_roles ADD COLUMN IF NOT EXISTS sub_items_json TEXT",
    # Email / branding alanlari
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mail_domain VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS app_url VARCHAR(500)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS use_custom_app_url BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS imap_port INTEGER",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS pop3_host VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS pop3_port INTEGER",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS incoming_use_ssl BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS reply_to_email VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS bounce_email VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_support_email VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS enable_list_unsubscribe BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS enable_strict_from_alignment BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_type VARCHAR(32) DEFAULT 'none' NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_url VARCHAR(500)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_api_url VARCHAR(500)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_username VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_password VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_api_token VARCHAR(500)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_verify_ssl BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_auto_create BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS mailbox_provider_custom_endpoint VARCHAR(500)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS signature_name VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS signature_title VARCHAR(255)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS signature_note VARCHAR(1000)",
    "ALTER TABLE email_settings ADD COLUMN IF NOT EXISTS signature_image_url VARCHAR(500)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS signature_name VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS signature_title VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS signature_note TEXT",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS signature_image_url VARCHAR(500)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS imap_port INTEGER",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS imap_username VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS imap_password VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS imap_use_ssl BOOLEAN DEFAULT TRUE NOT NULL",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS mailbox_folder VARCHAR(255)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS last_inbox_sync_at VARCHAR(64)",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS last_inbox_error TEXT",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS mailbox_provision_status VARCHAR(32) DEFAULT 'pending' NOT NULL",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS mailbox_provision_message TEXT",
    "ALTER TABLE system_emails ADD COLUMN IF NOT EXISTS mailbox_provisioned_at VARCHAR(64)",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS body_html TEXT",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS attachments_json TEXT",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS thread_key VARCHAR(255)",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS in_reply_to VARCHAR(255)",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS references_header TEXT",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS is_starred BOOLEAN DEFAULT FALSE NOT NULL",
    "ALTER TABLE system_email_messages ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE NOT NULL",
    "CREATE INDEX IF NOT EXISTS ix_system_email_messages_thread_key ON system_email_messages(thread_key)",
    # Panel teması override kayıt tablosu — tek satırlık singleton (id=1)
    # CREATE TABLE IF NOT EXISTS: create_all tarafından oluşturulur; burada sadece seed INSERT.
    "INSERT INTO panel_theme_settings (id, segments_json, version) VALUES (1, '{}', 1) ON CONFLICT (id) DO NOTHING",
    # Panel teması audit log tablosu — create_all tarafından oluşturulur, indeks ekle
    "CREATE INDEX IF NOT EXISTS ix_panel_theme_audit_logs_changed_at ON panel_theme_audit_logs(changed_at DESC)",
    # Panel profil tablosu — rol-combo başına profil JSON + audit log
    # (create_all ile oluşturulur; indeks + unique constraint burada güvence altına alınır)
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_panel_profiles_role ON panel_profiles(business_role, COALESCE(system_role, ''))",
    "CREATE INDEX IF NOT EXISTS ix_panel_profiles_biz ON panel_profiles(business_role)",
    "CREATE INDEX IF NOT EXISTS ix_panel_profile_audit_logs_at ON panel_profile_audit_logs(changed_at DESC)",
    "CREATE INDEX IF NOT EXISTS ix_panel_profile_audit_logs_biz ON panel_profile_audit_logs(business_role)",
    # Social login columns
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_google_id ON users(google_id)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS linkedin_id VARCHAR(255)",
    "CREATE UNIQUE INDEX IF NOT EXISTS ix_users_linkedin_id ON users(linkedin_id)",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS social_login_only BOOLEAN DEFAULT FALSE NOT NULL",
]


def main() -> int:
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        for statement in STATEMENTS:
            db.execute(text(statement))
        db.commit()
    finally:
        db.close()

    print("APPLIED_RUNTIME_COMPAT_COLUMNS")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
