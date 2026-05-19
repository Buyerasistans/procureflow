"""add mailbox team visibility toggle to companies

Revision ID: 20260429_add_company_mailbox_team_visibility_toggle
Revises: 20260428_add_dashboard_mail_button_toggle_to_email_settings
Create Date: 2026-04-29 01:20:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260429_add_company_mailbox_team_visibility_toggle"
down_revision = "20260428_add_dashboard_mail_button_toggle_to_email_settings"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "mailbox_team_visibility_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )

    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.alter_column("mailbox_team_visibility_enabled", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.drop_column("mailbox_team_visibility_enabled")
