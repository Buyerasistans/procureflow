"""
seed_demo_data.py · ProcureFlow DEMO veri seed'i (ORM / SQLAlchemy)
====================================================================
Süper admin ekranlarını dolu göstermek için GERÇEK modellere uygun, ADDITIVE
(mevcut veriyi değiştirmeyen) demo kayıtları ekler. Idempotsenttir
(doğal anahtarla var-yoksa-ekle).

YERLEŞİM:  api/scripts/seed_demo_data.py  (veya api/ kökü)
ÇALIŞTIRMA:
    # repo kökünde, api venv aktifken:
    python -m api.scripts.seed_demo_data
    # ya da:  cd api && python scripts/seed_demo_data.py

NOT:
- Yalnızca dev/stage. Prod'da çalıştırmayın.
- En az 1 `users` kaydı olmalı (Supplier.created_by_id ve ProcurementJob.
  posted_by_user_id NOT NULL'dur; ilk kullanıcı sahibi olarak alınır).
- Enum/kod değerleri gerçek modellerden alındı:
    Tenant.status (default 'active'), onboarding_status (default 'draft')
    CampaignProgram.audience_type ∈ {'supplier','channel'}
    CampaignProgram.trigger_event ∈ {'supplier_referral_activated',
                                     'partner_referral_activated'}
    ProcurementJob.employment_type ∈ {'full_time','part_time','contract','freelance'}
    ProcurementJob.location_type   ∈ {'remote','onsite','hybrid'}
    ProcurementJob.status          ∈ {'draft','published','closed','filled'}
    Supplier.dual_role_status      ∈ {None,'pending','active','rejected'}
- Kampanya `status` için model yalnızca default 'draft' tanımlar; canlı kampanyalar
  için aşağıda 'active' kullanıldı — kendi statü adınızla doğrulayın.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from api.db.session import SessionLocal
from api.models.tenant import Tenant
from api.models.company import Company
from api.models.supplier import Supplier
from api.models.talent import ProcurementJob
from api.models.campaign import CampaignProgram
from api.models.user import User


def _now() -> datetime:
    return datetime.now(timezone.utc)


def seed_demo_data() -> None:
    db = SessionLocal()
    created = {"tenants": 0, "companies": 0, "suppliers": 0, "jobs": 0, "campaigns": 0}
    try:
        owner = db.query(User).order_by(User.id).first()
        if owner is None:
            raise RuntimeError(
                "En az bir users kaydı gerekli "
                "(Supplier.created_by_id / ProcurementJob.posted_by_user_id)."
            )

        # ------------------------------------------------------------------
        # 1) STRATEJİK PARTNER (Tenant) + ana/alt firmalar (Company)
        #    Alt firma = aynı tenant_id, is_primary=False. Ana firma is_primary=True.
        # ------------------------------------------------------------------
        def ensure_tenant(slug: str, **kwargs) -> Tenant:
            t = db.query(Tenant).filter(Tenant.slug == slug).first()
            if t:
                return t
            t = Tenant(slug=slug, owner_user_id=owner.id, **kwargs)
            db.add(t)
            db.flush()  # id lazım
            created["tenants"] += 1
            return t

        def ensure_company(tenant_id: int, name: str, **kwargs) -> Company:
            # companies UniqueConstraint(tenant_id, name)
            c = (
                db.query(Company)
                .filter(Company.tenant_id == tenant_id, Company.name == name)
                .first()
            )
            if c:
                return c
            c = Company(tenant_id=tenant_id, name=name, created_by_id=owner.id, **kwargs)
            db.add(c)
            db.flush()
            created["companies"] += 1
            return c

        # Partner A: Demir Çelik Holding (doğrudan)
        demir = ensure_tenant(
            "demir-celik-holding",
            legal_name="Demir Çelik Holding A.Ş.",
            brand_name="Demir Çelik",
            city="Karabük",
            country="Türkiye",
            status="active",
            onboarding_status="completed",
            subscription_plan_code="growth",  # subscription_plans.code ile eşleşmeli
            category="Metal & Çelik",
        )
        ensure_company(
            demir.id, "Demir Çelik Sanayi A.Ş.", short_name="Demir Çelik",
            trade_name="Demir Çelik Sanayi ve Ticaret A.Ş.", color="#1d4ed8",
            is_primary=True, city="Karabük",
        )
        ensure_company(
            demir.id, "Demir Döküm Ltd.", short_name="Demir Döküm",
            trade_name="Demir Döküm Sanayi Ltd. Şti.", color="#0e7490",
            is_primary=False, city="Karabük",
        )
        ensure_company(
            demir.id, "Demir Lojistik A.Ş.", short_name="Demir Loj",
            trade_name="Demir Lojistik ve Taşımacılık A.Ş.", color="#b45309",
            is_primary=False, city="Kocaeli",
        )

        # Partner B: Ege Gıda Grup (deneme)
        ege = ensure_tenant(
            "ege-gida-grup",
            legal_name="Ege Gıda Grup A.Ş.",
            brand_name="Ege Gıda",
            city="İzmir",
            country="Türkiye",
            status="trial",
            onboarding_status="trial",
            subscription_plan_code="starter",
            category="Gıda Üretim",
        )
        ensure_company(
            ege.id, "Ege Gıda Üretim A.Ş.", short_name="Ege Gıda",
            trade_name="Ege Gıda Üretim ve Pazarlama A.Ş.", color="#15803d",
            is_primary=True, city="İzmir",
        )
        ensure_company(
            ege.id, "Ege Soğuk Zincir Ltd.", short_name="Ege Soğuk",
            trade_name="Ege Soğuk Zincir Lojistik Ltd.", color="#0891b2",
            is_primary=False, city="İzmir",
        )

        # ------------------------------------------------------------------
        # 2) TEDARİKÇİLER (Supplier) — 2 normal + 2 çift rol (linked_tenant_id)
        # ------------------------------------------------------------------
        def ensure_supplier(email: str, **kwargs) -> Supplier:
            s = db.query(Supplier).filter(Supplier.email == email).first()
            if s:
                return s
            s = Supplier(email=email, created_by_id=owner.id, **kwargs)
            db.add(s)
            db.flush()
            created["suppliers"] += 1
            return s

        ensure_supplier(
            "satis@karbonmetal.com", company_name="Karbon Metal A.Ş.",
            company_title="Sac & profil", phone="+90 370 555 10 10",
            city="Karabük", reference_score=4.5, category="Hammadde",
            is_active=True, is_verified=True,
        )
        ensure_supplier(
            "info@batiambalaj.com", company_name="Batı Ambalaj Ltd.",
            company_title="Oluklu mukavva", phone="+90 232 555 20 20",
            city="İzmir", reference_score=4.2, category="Ambalaj",
            is_active=True, is_verified=True,
        )
        # çift rol (aktif) → Demir Çelik Holding'e bağlı, havuzda da tedarikçi
        ensure_supplier(
            "satis@anadolukimya.com", company_name="Anadolu Kimya A.Ş.",
            company_title="Endüstriyel kimyasallar", phone="+90 312 555 30 30",
            city="Ankara", reference_score=4.8, category="Kimya",
            is_active=True, is_verified=True,
            dual_role_status="active", linked_tenant_id=demir.id,
        )
        # çift rol (beklemede) → Ege Gıda Grup'a bağlı
        ensure_supplier(
            "info@marmaranakliyat.com", company_name="Marmara Nakliyat Ltd.",
            company_title="Yurt içi lojistik", phone="+90 216 555 40 40",
            city="İstanbul", reference_score=3.9, category="Lojistik",
            is_active=True, is_verified=False,
            dual_role_status="pending", linked_tenant_id=ege.id,
        )

        # ------------------------------------------------------------------
        # 3) İLANLAR (ProcurementJob)
        # ------------------------------------------------------------------
        def ensure_job(title: str, **kwargs) -> ProcurementJob:
            j = db.query(ProcurementJob).filter(ProcurementJob.title == title).first()
            if j:
                return j
            j = ProcurementJob(title=title, posted_by_user_id=owner.id, **kwargs)
            db.add(j)
            db.flush()
            created["jobs"] += 1
            return j

        ensure_job(
            "Kıdemli Satınalma Uzmanı", tenant_id=demir.id,
            description="Metal sektöründe RFQ ve tedarikçi yönetimi.",
            category="Satınalma", employment_type="full_time", location_type="onsite",
            city="Karabük", country="Türkiye", salary_min=55000, salary_max=80000,
            salary_currency="TRY", salary_period="monthly", min_experience_years=5,
            status="published", is_procurement_only=True,
        )
        ensure_job(
            "Lojistik Planlama Mühendisi", tenant_id=ege.id,
            description="Soğuk zincir operasyon planlaması.",
            category="Lojistik", employment_type="full_time", location_type="hybrid",
            city="İzmir", country="Türkiye", salary_min=48000, salary_max=70000,
            salary_currency="TRY", salary_period="monthly", min_experience_years=3,
            status="published", is_procurement_only=True,
        )
        ensure_job(
            "Tedarik Zinciri Analisti", tenant_id=None,  # platform geneli
            description="Platform genelinde tedarik analitiği (uzaktan).",
            category="Analiz", employment_type="full_time", location_type="remote",
            city="Türkiye", country="Türkiye", salary_min=45000, salary_max=65000,
            salary_currency="TRY", salary_period="monthly", min_experience_years=2,
            status="published", is_procurement_only=True,
        )

        # ------------------------------------------------------------------
        # 4) KAMPANYALAR (CampaignProgram) — audience yalnız supplier|channel
        # ------------------------------------------------------------------
        def ensure_campaign(code: str, **kwargs) -> CampaignProgram:
            c = db.query(CampaignProgram).filter(CampaignProgram.code == code).first()
            if c:
                return c
            c = CampaignProgram(code=code, **kwargs)
            db.add(c)
            db.flush()
            created["campaigns"] += 1
            return c

        ensure_campaign(
            "demo-supplier-pool", name="Havuz Üyelik Kampanyası",
            description="Havuza ücretsiz katılım dönemi.",
            audience_type="supplier", trigger_event="supplier_referral_activated",
            status="active", is_public=True,
            starts_at=_now(), ends_at=_now() + timedelta(days=60),
        )
        ensure_campaign(
            "demo-channel-bonus", name="İş Ortağı Getiri Bonusu",
            description="Yönlendirme başına ek komisyon.",
            audience_type="channel", trigger_event="partner_referral_activated",
            status="active", is_public=True,
            starts_at=_now(), ends_at=_now() + timedelta(days=90),
        )
        ensure_campaign(
            "demo-channel-draft", name="Kanal Pilot (taslak)",
            description="Taslak halinde kanal kampanyası.",
            audience_type="channel", trigger_event="partner_referral_activated",
            status="draft", is_public=False,
        )

        db.commit()
        print("Demo veri eklendi (idempotent):", created)
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
