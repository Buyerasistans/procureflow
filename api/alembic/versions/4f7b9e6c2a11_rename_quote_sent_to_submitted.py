"""rename quote sent status to submitted

Revision ID: 4f7b9e6c2a11
Revises: add_revision_system
Create Date: 2026-04-08 19:45:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "4f7b9e6c2a11"
down_revision: Union[str, Sequence[str], None] = "add_revision_system"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE quotes SET status = 'submitted' WHERE status = 'sent'")
    )
    conn.execute(
        sa.text(
            "UPDATE quote_status_logs SET from_status = 'submitted' WHERE from_status = 'sent'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE quote_status_logs SET to_status = 'submitted' WHERE to_status = 'sent'"
        )
    )


def downgrade() -> None:
    conn = op.get_bind()
    conn.execute(
        sa.text("UPDATE quotes SET status = 'sent' WHERE status = 'submitted'")
    )
    conn.execute(
        sa.text(
            "UPDATE quote_status_logs SET from_status = 'sent' WHERE from_status = 'submitted'"
        )
    )
    conn.execute(
        sa.text(
            "UPDATE quote_status_logs SET to_status = 'sent' WHERE to_status = 'submitted'"
        )
    )
