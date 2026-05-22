"""merge heads

Revision ID: 9776a313828d
Revises: d1e2c25969f3, 20260413_create_smtp_settings_table
Create Date: 2026-04-13 04:25:32.400462

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9776a313828d"
down_revision: Union[str, Sequence[str], None] = (
    "d1e2c25969f3",
    "20260413_create_smtp_settings_table",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
