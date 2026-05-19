from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260415_add_discovery_lab_session_context_columns"
down_revision: Union[str, Sequence[str], None] = "1216ab445426"
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if table_name not in inspector.get_table_names():
        return False
    return any(
        column["name"] == column_name for column in inspector.get_columns(table_name)
    )


def upgrade() -> None:
    if not _has_table("discovery_lab_sessions"):
        return

    if not _has_column("discovery_lab_sessions", "created_by_user_id"):
        op.add_column(
            "discovery_lab_sessions",
            sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_discovery_lab_sessions_created_by_user_id",
            "discovery_lab_sessions",
            ["created_by_user_id"],
            unique=False,
        )
    if not _has_column("discovery_lab_sessions", "created_by_email"):
        op.add_column(
            "discovery_lab_sessions",
            sa.Column("created_by_email", sa.String(length=255), nullable=True),
        )
    if not _has_column("discovery_lab_sessions", "selected_project_id"):
        op.add_column(
            "discovery_lab_sessions",
            sa.Column("selected_project_id", sa.Integer(), nullable=True),
        )
        op.create_index(
            "ix_discovery_lab_sessions_selected_project_id",
            "discovery_lab_sessions",
            ["selected_project_id"],
            unique=False,
        )
    if not _has_column("discovery_lab_sessions", "selected_project_name"):
        op.add_column(
            "discovery_lab_sessions",
            sa.Column("selected_project_name", sa.String(length=255), nullable=True),
        )


def downgrade() -> None:
    if not _has_table("discovery_lab_sessions"):
        return

    bind = op.get_bind()
    inspector = sa.inspect(bind)
    indexes = {
        index["name"] for index in inspector.get_indexes("discovery_lab_sessions")
    }

    if "ix_discovery_lab_sessions_selected_project_id" in indexes:
        op.drop_index(
            "ix_discovery_lab_sessions_selected_project_id",
            table_name="discovery_lab_sessions",
        )
    if _has_column("discovery_lab_sessions", "selected_project_name"):
        op.drop_column("discovery_lab_sessions", "selected_project_name")
    if _has_column("discovery_lab_sessions", "selected_project_id"):
        op.drop_column("discovery_lab_sessions", "selected_project_id")
    if _has_column("discovery_lab_sessions", "created_by_email"):
        op.drop_column("discovery_lab_sessions", "created_by_email")
    if "ix_discovery_lab_sessions_created_by_user_id" in indexes:
        op.drop_index(
            "ix_discovery_lab_sessions_created_by_user_id",
            table_name="discovery_lab_sessions",
        )
    if _has_column("discovery_lab_sessions", "created_by_user_id"):
        op.drop_column("discovery_lab_sessions", "created_by_user_id")
