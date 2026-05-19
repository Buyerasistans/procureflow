"""
Migration: Eski quote status değerlerini yeni enum değerlerine çevirir.

- 'pending', 'sent', 'responded' -> 'submitted'

Kullanım: Alembic ile upgrade sırasında otomatik çalışır.
"""

from alembic import op

# revision identifiers, used by Alembic.
revision = "fix_status_enum_cleanup"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.execute("""
    UPDATE quotes SET status='submitted' WHERE status IN ('pending', 'sent', 'responded');
    """)


def downgrade():
    # Geri alma işlemi yok, tek yönlü temizlik
    pass
