"""add dashboard mail button toggle to email settings

Revision ID: 20260428_add_dashboard_mail_button_toggle_to_email_settings
Revises: 20260421_add_is_primary_to_companies
Create Date: 2026-04-28 10:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260428_add_dashboard_mail_button_toggle_to_email_settings"
down_revision = "20260421_add_is_primary_to_companies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("email_settings", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "dashboard_mail_button_enabled",
                sa.Boolean(),
                nullable=False,
                server_default=sa.true(),
            )
        )

    with op.batch_alter_table("email_settings", schema=None) as batch_op:
        batch_op.alter_column("dashboard_mail_button_enabled", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("email_settings", schema=None) as batch_op:
        batch_op.drop_column("dashboard_mail_button_enabled")
