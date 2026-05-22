"""merge heads for email_settings

Revision ID: e4a1b9b7f93a
Revises: 9776a313828d, 20260413_create_email_settings_table
Create Date: 2026-04-13 04:27:21.405471

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e4a1b9b7f93a"
down_revision: Union[str, Sequence[str], None] = (
    "9776a313828d",
    "20260413_create_email_settings_table",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    from alembic import op
    import sqlalchemy as sa

    op.create_table(
        "email_settings",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("email", sa.String(length=255), nullable=False, unique=True),
        sa.Column("password", sa.String(length=255), nullable=False),
        sa.Column(
            "smtp_host",
            sa.String(length=255),
            nullable=False,
            default="buyerasistans.com.tr",
        ),
        sa.Column("smtp_port", sa.Integer(), nullable=False, default=465),
        sa.Column("use_tls", sa.Boolean(), nullable=False, default=True),
        sa.Column("use_ssl", sa.Boolean(), nullable=False, default=True),
        sa.Column(
            "enable_email_notifications", sa.Boolean(), nullable=False, default=True
        ),
        sa.Column(
            "display_name", sa.String(length=255), nullable=False, default="ProcureFlow"
        ),
        sa.Column("description", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    """Downgrade schema."""
    pass
