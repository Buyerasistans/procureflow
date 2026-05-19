# api\alembic\versions\2fbb93265c51_create_refresh_tokens_table_if_missing.py
"""create refresh_tokens table if missing

Revision ID: 2fbb93265c51
Revises: 61a92ea2adc0
Create Date: 2026-03-29 10:00:15.850313

"""

from alembic import op
import sqlalchemy as sa

revision = "2fbb93265c51"
down_revision = "61a92ea2adc0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "refresh_tokens",
        sa.Column("jti", sa.String(length=64), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("jti"),
    )
    op.create_index("ix_refresh_tokens_jti", "refresh_tokens", ["jti"], unique=False)
    op.create_index(
        "ix_refresh_tokens_user_id", "refresh_tokens", ["user_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_refresh_tokens_user_id", table_name="refresh_tokens")
    op.drop_index("ix_refresh_tokens_jti", table_name="refresh_tokens")
    op.drop_table("refresh_tokens")
