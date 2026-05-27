"""add_talent_network_and_procurement_jobs_tables

Revision ID: 76f4c14237af
Revises: 20260429_add_company_mailbox_team_visibility_toggle
Create Date: 2026-05-26 22:30:43.220183

Scope: PHASE 0 — Talent Network + Procurement Jobs veri modeli.
Sadece yeni talent ekosistemi tablolarını ekler; mevcut tablolara dokunmaz.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '76f4c14237af'
down_revision: Union[str, Sequence[str], None] = '20260429_add_company_mailbox_team_visibility_toggle'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # -- İlan (parent) ve görev (parent) tablolar önce --
    op.create_table(
        'procurement_jobs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('tenant_id', sa.Integer(), nullable=True,
                  comment='İşveren tenant — platform geneli ilanlar için NULL'),
        sa.Column('posted_by_user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=True,
                  comment='Satınalma rol kategorisi'),
        sa.Column('employment_type', sa.String(length=30), nullable=False,
                  comment='full_time | part_time | contract | freelance'),
        sa.Column('location_type', sa.String(length=30), nullable=False,
                  comment='remote | onsite | hybrid'),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('salary_min', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('salary_max', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('salary_currency', sa.String(length=10), nullable=False),
        sa.Column('salary_period', sa.String(length=20), nullable=False,
                  comment='monthly | annual | daily'),
        sa.Column('required_skills_json', sa.Text(), nullable=True),
        sa.Column('min_experience_years', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False,
                  comment='draft | published | closed | filled'),
        sa.Column('application_deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_procurement_only', sa.Boolean(), nullable=False),
        sa.Column('view_count', sa.Integer(), nullable=False),
        sa.Column('application_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['posted_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_procurement_jobs_id', 'procurement_jobs', ['id'])
    op.create_index('ix_procurement_jobs_posted_by_user_id', 'procurement_jobs', ['posted_by_user_id'])
    op.create_index('ix_procurement_jobs_tenant_id', 'procurement_jobs', ['tenant_id'])

    op.create_table(
        'referral_tasks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('created_by_user_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=False),
        sa.Column('task_type', sa.String(length=50), nullable=False,
                  comment='supplier_discovery | partner_referral | rfq_enrichment | category_advisory'),
        sa.Column('reward_amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('reward_currency', sa.String(length=10), nullable=False),
        sa.Column('reward_type', sa.String(length=30), nullable=False,
                  comment='fixed | success_based | bonus'),
        sa.Column('target_category', sa.String(length=100), nullable=True),
        sa.Column('instructions_json', sa.Text(), nullable=True,
                  comment='Görev talimatları JSON'),
        sa.Column('max_submissions', sa.Integer(), nullable=True,
                  comment='NULL = sınırsız'),
        sa.Column('deadline', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False,
                  comment='active | closed | expired | draft'),
        sa.Column('submission_count', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_referral_tasks_id', 'referral_tasks', ['id'])
    op.create_index('ix_referral_tasks_created_by_user_id', 'referral_tasks', ['created_by_user_id'])

    # -- Talent profili (child tablolar bunun üstünde FK kurar) --
    op.create_table(
        'talent_profiles',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('availability', sa.String(length=30), nullable=False,
                  comment='full_time | part_time | freelance | not_available'),
        sa.Column('experience_years', sa.Integer(), nullable=True),
        sa.Column('linkedin_url', sa.String(length=500), nullable=True),
        sa.Column('bio', sa.Text(), nullable=True),
        sa.Column('skills_json', sa.Text(), nullable=True),
        sa.Column('category_expertise_json', sa.Text(), nullable=True),
        sa.Column('kyc_status', sa.String(length=30), nullable=False,
                  comment='pending | approved | rejected'),
        sa.Column('kyc_reviewed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('kyc_reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('kyc_notes', sa.Text(), nullable=True),
        sa.Column('reputation_score', sa.Integer(), nullable=False),
        sa.Column('total_earned', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('total_paid_out', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('is_public', sa.Boolean(), nullable=False,
                  comment='Profil herkese görünür mü'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['kyc_reviewed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_talent_profiles_id', 'talent_profiles', ['id'])
    op.create_index('ix_talent_profiles_user_id', 'talent_profiles', ['user_id'], unique=True)

    # -- Child tablolar --
    op.create_table(
        'earnings_ledger',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('talent_profile_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False,
                  comment='referral_reward | job_placement | bonus | payout | payout_fee | adjustment'),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('balance_after', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by_user_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['talent_profile_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_earnings_ledger_id', 'earnings_ledger', ['id'])
    op.create_index('ix_earnings_ledger_user_id', 'earnings_ledger', ['user_id'])
    op.create_index('ix_earnings_ledger_talent_profile_id', 'earnings_ledger', ['talent_profile_id'])

    op.create_table(
        'job_applications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('job_id', sa.Integer(), nullable=False),
        sa.Column('applicant_user_id', sa.Integer(), nullable=False),
        sa.Column('talent_profile_id', sa.Integer(), nullable=False),
        sa.Column('cover_letter', sa.Text(), nullable=True),
        sa.Column('status', sa.String(length=30), nullable=False,
                  comment='applied | shortlisted | interview | offered | rejected | withdrawn'),
        sa.Column('ai_match_score', sa.Integer(), nullable=True,
                  comment='0-100 arasında AI eşleşme skoru'),
        sa.Column('employer_note', sa.Text(), nullable=True),
        sa.Column('reviewed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('applied_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['applicant_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['job_id'], ['procurement_jobs.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['reviewed_by_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['talent_profile_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('job_id', 'applicant_user_id', name='uq_job_applicant'),
    )
    op.create_index('ix_job_applications_id', 'job_applications', ['id'])
    op.create_index('ix_job_applications_job_id', 'job_applications', ['job_id'])
    op.create_index('ix_job_applications_applicant_user_id', 'job_applications', ['applicant_user_id'])
    op.create_index('ix_job_applications_talent_profile_id', 'job_applications', ['talent_profile_id'])

    op.create_table(
        'payout_requests',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('talent_profile_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=14, scale=2), nullable=False),
        sa.Column('currency', sa.String(length=10), nullable=False),
        sa.Column('payment_method', sa.String(length=30), nullable=False,
                  comment='bank_transfer | iban'),
        sa.Column('bank_details_json', sa.Text(), nullable=True,
                  comment='Hassas banka bilgileri — maskeli saklanır'),
        sa.Column('status', sa.String(length=30), nullable=False,
                  comment='pending | approved | processing | paid | rejected'),
        sa.Column('reviewer_user_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('paid_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('rejection_reason', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reviewer_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['talent_profile_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_payout_requests_id', 'payout_requests', ['id'])
    op.create_index('ix_payout_requests_user_id', 'payout_requests', ['user_id'])
    op.create_index('ix_payout_requests_talent_profile_id', 'payout_requests', ['talent_profile_id'])

    op.create_table(
        'referral_submissions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('task_id', sa.Integer(), nullable=False),
        sa.Column('submitter_user_id', sa.Integer(), nullable=False),
        sa.Column('talent_profile_id', sa.Integer(), nullable=False),
        sa.Column('submission_content_json', sa.Text(), nullable=False,
                  comment='Görev tipine göre yapılandırılmış katkı verisi'),
        sa.Column('status', sa.String(length=30), nullable=False,
                  comment='pending | approved | rejected | rewarded'),
        sa.Column('reviewer_user_id', sa.Integer(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('review_note', sa.Text(), nullable=True),
        sa.Column('approved_reward', sa.Numeric(precision=14, scale=2), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['reviewer_user_id'], ['users.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['submitter_user_id'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['talent_profile_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['task_id'], ['referral_tasks.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('task_id', 'submitter_user_id', name='uq_task_submitter'),
    )
    op.create_index('ix_referral_submissions_id', 'referral_submissions', ['id'])
    op.create_index('ix_referral_submissions_task_id', 'referral_submissions', ['task_id'])
    op.create_index('ix_referral_submissions_submitter_user_id', 'referral_submissions', ['submitter_user_id'])
    op.create_index('ix_referral_submissions_talent_profile_id', 'referral_submissions', ['talent_profile_id'])

    op.create_table(
        'reputation_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('talent_profile_id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False,
                  comment='task_completed | task_rejected | job_placed | rating_received | penalty | bonus'),
        sa.Column('score_delta', sa.Integer(), nullable=False,
                  comment='Pozitif = artış, negatif = azalış'),
        sa.Column('score_after', sa.Integer(), nullable=False,
                  comment='Bu event sonrasındaki toplam puan'),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['talent_profile_id'], ['talent_profiles.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_reputation_events_id', 'reputation_events', ['id'])
    op.create_index('ix_reputation_events_user_id', 'reputation_events', ['user_id'])
    op.create_index('ix_reputation_events_talent_profile_id', 'reputation_events', ['talent_profile_id'])


def downgrade() -> None:
    # Child tablolar önce drop edilmeli
    op.drop_index('ix_reputation_events_talent_profile_id', table_name='reputation_events')
    op.drop_index('ix_reputation_events_user_id', table_name='reputation_events')
    op.drop_index('ix_reputation_events_id', table_name='reputation_events')
    op.drop_table('reputation_events')

    op.drop_index('ix_referral_submissions_talent_profile_id', table_name='referral_submissions')
    op.drop_index('ix_referral_submissions_submitter_user_id', table_name='referral_submissions')
    op.drop_index('ix_referral_submissions_task_id', table_name='referral_submissions')
    op.drop_index('ix_referral_submissions_id', table_name='referral_submissions')
    op.drop_table('referral_submissions')

    op.drop_index('ix_payout_requests_talent_profile_id', table_name='payout_requests')
    op.drop_index('ix_payout_requests_user_id', table_name='payout_requests')
    op.drop_index('ix_payout_requests_id', table_name='payout_requests')
    op.drop_table('payout_requests')

    op.drop_index('ix_job_applications_talent_profile_id', table_name='job_applications')
    op.drop_index('ix_job_applications_applicant_user_id', table_name='job_applications')
    op.drop_index('ix_job_applications_job_id', table_name='job_applications')
    op.drop_index('ix_job_applications_id', table_name='job_applications')
    op.drop_table('job_applications')

    op.drop_index('ix_earnings_ledger_talent_profile_id', table_name='earnings_ledger')
    op.drop_index('ix_earnings_ledger_user_id', table_name='earnings_ledger')
    op.drop_index('ix_earnings_ledger_id', table_name='earnings_ledger')
    op.drop_table('earnings_ledger')

    op.drop_index('ix_talent_profiles_user_id', table_name='talent_profiles')
    op.drop_index('ix_talent_profiles_id', table_name='talent_profiles')
    op.drop_table('talent_profiles')

    op.drop_index('ix_referral_tasks_created_by_user_id', table_name='referral_tasks')
    op.drop_index('ix_referral_tasks_id', table_name='referral_tasks')
    op.drop_table('referral_tasks')

    op.drop_index('ix_procurement_jobs_tenant_id', table_name='procurement_jobs')
    op.drop_index('ix_procurement_jobs_posted_by_user_id', table_name='procurement_jobs')
    op.drop_index('ix_procurement_jobs_id', table_name='procurement_jobs')
    op.drop_table('procurement_jobs')
