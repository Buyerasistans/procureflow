"""merge quote submitted branch

Revision ID: 9bac61044cb0
Revises: 10775f598ff0, 4f7b9e6c2a11
Create Date: 2026-04-08 20:22:13.443325

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "9bac61044cb0"
down_revision: Union[str, Sequence[str], None] = ("10775f598ff0", "4f7b9e6c2a11")
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
