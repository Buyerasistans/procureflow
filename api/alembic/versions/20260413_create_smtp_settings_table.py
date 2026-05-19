"""
Alembic migration script to create smtp_settings table
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260413_create_smtp_settings_table"
down_revision = "12609f3c5e9d"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "smtp_settings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("smtp_host", sa.String(length=255), nullable=False, default=""),
        sa.Column("smtp_port", sa.Integer(), nullable=False, default=587),
        sa.Column("smtp_username", sa.String(length=255), nullable=True, default=""),
        sa.Column("smtp_password", sa.String(length=255), nullable=True, default=""),
        sa.Column(
            "from_email",
            sa.String(length=255),
            nullable=False,
            default="noreply@procureflow.com",
        ),
        sa.Column(
            "from_name", sa.String(length=255), nullable=False, default="ProcureFlow"
        ),
        sa.Column("use_tls", sa.Boolean(), nullable=False, default=True),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, default=False),
        sa.Column(
            "enable_email_notifications", sa.Boolean(), nullable=False, default=False
        ),
    )


def downgrade():
    op.drop_table("smtp_settings")
