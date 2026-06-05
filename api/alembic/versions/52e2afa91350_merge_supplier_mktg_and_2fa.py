"""merge_supplier_mktg_and_2fa

Revision ID: 52e2afa91350
Revises: 20260605_supplier_mktg, c3d4e5f6a7b8
Create Date: 2026-06-05 05:47:15.346602

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '52e2afa91350'
down_revision: Union[str, Sequence[str], None] = ('20260605_supplier_mktg', 'c3d4e5f6a7b8')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
