from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260421_add_short_name_to_companies"
down_revision: Union[str, Sequence[str], None] = (
    "20260415_add_discovery_lab_answer_audits"
)
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.add_column(
            sa.Column("short_name", sa.String(length=60), nullable=True)
        )


def downgrade() -> None:
    with op.batch_alter_table("companies") as batch_op:
        batch_op.drop_column("short_name")
