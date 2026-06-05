"""add linked_tenant_id to suppliers

Revision ID: a1b2c3d4e5f6
Revises: 76f4c14237af
Create Date: 2026-06-04 10:00:00.000000

Adds suppliers.linked_tenant_id (nullable FK → tenants.id) that was present
in the ORM model but never had a corresponding migration, causing 500 errors
on production for any endpoint that queries the suppliers table.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "76f4c14237af"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "suppliers",
        sa.Column("linked_tenant_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(
        "fk_suppliers_linked_tenant_id",
        "suppliers",
        "tenants",
        ["linked_tenant_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_suppliers_linked_tenant_id", "suppliers", type_="foreignkey")
    op.drop_column("suppliers", "linked_tenant_id")
