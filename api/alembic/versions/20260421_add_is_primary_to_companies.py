"""add is_primary to companies

Revision ID: 20260421_add_is_primary_to_companies
Revises: 20260421_add_short_name_to_companies
Create Date: 2026-04-21 20:40:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "20260421_add_is_primary_to_companies"
down_revision = "20260421_add_short_name_to_companies"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.add_column(
            sa.Column(
                "is_primary", sa.Boolean(), nullable=False, server_default=sa.false()
            )
        )

    op.execute(
        sa.text(
            """
            UPDATE companies c
            SET is_primary = TRUE
            WHERE c.tenant_id IS NOT NULL
              AND c.id IN (
                  SELECT MIN(c2.id)
                  FROM companies c2
                  WHERE c2.tenant_id = c.tenant_id
              )
            """
        )
    )

    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.alter_column("is_primary", server_default=None)


def downgrade() -> None:
    with op.batch_alter_table("companies", schema=None) as batch_op:
        batch_op.drop_column("is_primary")
