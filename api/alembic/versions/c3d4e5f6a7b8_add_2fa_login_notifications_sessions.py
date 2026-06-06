"""add 2fa, login_notifications, refresh_token.created_at

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-04 12:00:00.000000

Adds:
  users.totp_secret         (Text, nullable)
  users.totp_enabled        (Boolean, not null, default False)
  users.login_notifications (Boolean, not null, default True)
  refresh_tokens.created_at (DateTime tz, nullable, server_default=now())
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column(
        "users",
        sa.Column("totp_enabled", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "users",
        sa.Column("login_notifications", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "refresh_tokens",
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=True,
            server_default=sa.func.now(),
        ),
    )


def downgrade() -> None:
    op.drop_column("refresh_tokens", "created_at")
    op.drop_column("users", "login_notifications")
    op.drop_column("users", "totp_enabled")
    op.drop_column("users", "totp_secret")
