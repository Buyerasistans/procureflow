"""add dual_role_status to suppliers

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-06-04 10:05:00.000000

Adds suppliers.dual_role_status (varchar(20), nullable) that was added to the
ORM model without a migration.  Values: None | "pending" | "active" | "rejected".
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "suppliers",
        sa.Column("dual_role_status", sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("suppliers", "dual_role_status")
