from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260415_add_discovery_lab_answer_audits"
down_revision: Union[str, Sequence[str], None] = (
    "20260415_add_discovery_lab_session_context_columns"
)
branch_labels = None
depends_on = None


def _has_table(table_name: str) -> bool:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    return table_name in inspector.get_table_names()


def upgrade() -> None:
    if not _has_table("discovery_lab_sessions") or _has_table(
        "discovery_lab_answer_audits"
    ):
        return

    op.create_table(
        "discovery_lab_answer_audits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "session_ref_id",
            sa.Integer(),
            sa.ForeignKey("discovery_lab_sessions.id"),
            nullable=False,
        ),
        sa.Column("question_id", sa.Integer(), nullable=False),
        sa.Column("question_text", sa.Text(), nullable=True),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("decision", sa.String(length=50), nullable=True),
        sa.Column("rationale", sa.Text(), nullable=True),
        sa.Column("created_by_user_id", sa.Integer(), nullable=True),
        sa.Column("created_by_email", sa.String(length=255), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index(
        "ix_discovery_lab_answer_audits_session_ref_id",
        "discovery_lab_answer_audits",
        ["session_ref_id"],
        unique=False,
    )
    op.create_index(
        "ix_discovery_lab_answer_audits_question_id",
        "discovery_lab_answer_audits",
        ["question_id"],
        unique=False,
    )
    op.create_index(
        "ix_discovery_lab_answer_audits_created_by_user_id",
        "discovery_lab_answer_audits",
        ["created_by_user_id"],
        unique=False,
    )


def downgrade() -> None:
    if not _has_table("discovery_lab_answer_audits"):
        return

    op.drop_index(
        "ix_discovery_lab_answer_audits_created_by_user_id",
        table_name="discovery_lab_answer_audits",
    )
    op.drop_index(
        "ix_discovery_lab_answer_audits_question_id",
        table_name="discovery_lab_answer_audits",
    )
    op.drop_index(
        "ix_discovery_lab_answer_audits_session_ref_id",
        table_name="discovery_lab_answer_audits",
    )
    op.drop_table("discovery_lab_answer_audits")
