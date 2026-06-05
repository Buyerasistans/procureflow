"""add supplier_marketing_plans table

Revision ID: 20260605_supplier_mktg
Revises: b2c3d4e5f6a7
Create Date: 2026-06-05
"""
from alembic import op
import sqlalchemy as sa

revision = "20260605_supplier_mktg"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "supplier_marketing_plans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("supplier_id", sa.Integer(), sa.ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("headline", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("categories_json", sa.Text(), nullable=True),
        sa.Column("target_segments_json", sa.Text(), nullable=True),
        sa.Column("campaign_id", sa.Integer(), nullable=True, index=True),
        sa.Column("visibility", sa.String(20), nullable=False, server_default="draft"),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("valid_from", sa.DateTime(timezone=True), nullable=True),
        sa.Column("valid_until", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("supplier_marketing_plans")
