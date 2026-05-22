"""merge: status enum cleanup ile diğer migration birleşti

Revision ID: d1e2c25969f3
Revises: 25b2def06025, fix_status_enum_cleanup
Create Date: 2026-04-12 23:13:28.433612

"""

from typing import Sequence, Union


# revision identifiers, used by Alembic.
revision: str = "d1e2c25969f3"
down_revision: Union[str, Sequence[str], None] = (
    "25b2def06025",
    "fix_status_enum_cleanup",
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
