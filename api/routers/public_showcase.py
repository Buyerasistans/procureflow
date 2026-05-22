from __future__ import annotations

from sqlalchemy import func
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from api.database import get_db
from api.models.channel import ChannelOrganization, ChannelReferral, CommissionLedger
from api.models.payment import PaymentTransaction
from api.models.company import Company
from api.models.project import Project
from api.models.project_file import ProjectFile
from api.models.quote import Quote
from api.models.supplier import ProjectSupplier, Supplier
from api.models.supplier import SupplierQuote

router = APIRouter(prefix="/public/showcase", tags=["public-showcase"])


@router.get("/summary")
def get_public_showcase_summary(db: Session = Depends(get_db)):
    paid_supplier_ids = {
        supplier_id
        for (supplier_id,) in (
            db.query(PaymentTransaction.reference_id)
            .filter(
                PaymentTransaction.status == "succeeded",
                PaymentTransaction.reference_id.isnot(None),
                PaymentTransaction.reference_type.in_(
                    [
                        "supplier_pool",
                        "supplier_membership",
                        "supplier_subscription",
                        "supplier_visibility",
                    ]
                ),
            )
            .all()
        )
    }

    quotes = (
        db.query(
            Quote,
            Project.id.label("project_id"),
            Project.name.label("project_name"),
            Company.logo_url.label("company_logo_url"),
            Company.city.label("project_city"),
            Company.name.label("company_name"),
            Project.code.label("project_code"),
            func.count(ProjectFile.id).label("file_count"),
            func.count(func.distinct(ProjectSupplier.supplier_id)).label(
                "supplier_count"
            ),
            func.count(func.distinct(SupplierQuote.supplier_id)).label("bidder_count"),
        )
        .outerjoin(Project, Project.id == Quote.project_id)
        .outerjoin(Company, Company.id == Project.company_id)
        .outerjoin(ProjectFile, ProjectFile.project_id == Project.id)
        .outerjoin(ProjectSupplier, ProjectSupplier.project_id == Project.id)
        .outerjoin(SupplierQuote, SupplierQuote.quote_id == Quote.id)
        .filter(Quote.is_active.is_(True))
        .group_by(
            Quote.id,
            Project.id,
            Project.name,
            Company.name,
            Company.logo_url,
            Company.city,
            Project.code,
        )
        .order_by(Quote.created_at.desc())
        .limit(20)
        .all()
    )
    open_tenders = []
    for (
        quote,
        project_id,
        project_name,
        company_logo_url,
        project_city,
        company_name,
        project_code,
        file_count,
        supplier_count,
        bidder_count,
    ) in quotes:
        status = str(getattr(quote, "status", "") or "").lower()
        if status not in {"submitted", "pending", "responded", "approved"}:
            continue
        is_public_pool = bool(file_count and file_count > 0)
        open_tenders.append(
            {
                "id": quote.id,
                "title": quote.title,
                "status": status,
                "project_id": project_id,
                "project_name": project_name or "-",
                "project_code": project_code or "-",
                "project_city": project_city or "-",
                "company_name": company_name or quote.company_name or "-",
                "company_logo_url": company_logo_url,
                "file_count": int(file_count or 0),
                "supplier_count": int(supplier_count or 0),
                "bidder_count": int(bidder_count or 0),
                "offer_allowed": is_public_pool,
            }
        )
        if len(open_tenders) >= 8:
            break
    if not open_tenders:
        fallback_company = (
            db.query(Company)
            .filter(Company.is_active.is_(True))
            .order_by(Company.id.asc())
            .first()
        )
        fallback_project = None
        if fallback_company:
            fallback_project = (
                db.query(Project)
                .filter(Project.company_id == fallback_company.id)
                .order_by(Project.id.asc())
                .first()
            )
        fallback_company_name = (
            fallback_company.name if fallback_company else "BA Demo Merkez"
        )
        fallback_city = (
            fallback_company.city if fallback_company else None
        ) or "Istanbul"
        fallback_logo = fallback_company.logo_url if fallback_company else None
        open_tenders.append(
            {
                "id": 0,
                "title": "Demo Acik Ihale - Endustriyel Pompa Paketi",
                "status": "submitted",
                "project_name": fallback_project.name
                if fallback_project
                else "Veritabani Migrasyonu - YORPAS A.S.",
                "project_code": fallback_project.code if fallback_project else "DB-001",
                "project_city": fallback_city,
                "company_name": fallback_company_name,
                "company_logo_url": fallback_logo,
                "file_count": 2,
                "supplier_count": 0,
                "bidder_count": 0,
                "offer_allowed": True,
            }
        )

    supplier_rows = (
        db.query(
            Supplier.id,
            Supplier.company_name,
            Supplier.category,
            Supplier.city,
            Supplier.logo_url,
            Supplier.tenant_id,
            func.count(ProjectSupplier.id).label("invite_count"),
        )
        .outerjoin(ProjectSupplier, ProjectSupplier.supplier_id == Supplier.id)
        .filter(Supplier.is_active.is_(True))
        .group_by(
            Supplier.id,
            Supplier.company_name,
            Supplier.category,
            Supplier.city,
            Supplier.logo_url,
            Supplier.tenant_id,
        )
        .order_by(func.count(ProjectSupplier.id).desc(), Supplier.company_name.asc())
        .limit(50)
        .all()
    )
    supplier_pool = []
    for row in supplier_rows:
        invited_supplier = bool(row.invite_count and row.invite_count > 0)
        is_platform_supplier = row.tenant_id is None
        # Pool hakki: platforma dogrudan gelen (tenant disi) veya basarili odeme ile hak kazanmis supplier.
        qualified = is_platform_supplier or (row.id in paid_supplier_ids)
        if not qualified:
            continue
        supplier_pool.append(
            {
                "id": row.id,
                "company_name": row.company_name,
                "category": row.category or "Genel",
                "city": row.city or "-",
                "logo_url": row.logo_url,
                "invite_count": int(row.invite_count or 0),
                "qualified": qualified,
            }
        )
        if len(supplier_pool) >= 12:
            break
    if not supplier_pool:
        supplier_pool.append(
            {
                "id": 0,
                "company_name": "Demo Tedarikci A.S.",
                "category": "Mekanik",
                "city": "Istanbul",
                "logo_url": None,
                "invite_count": 1,
                "qualified": True,
            }
        )

    strategic_rows = (
        db.query(
            Company.id,
            Company.name,
            Company.city,
            Company.logo_url,
            func.count(func.distinct(Project.id)).label("project_count"),
            func.count(func.distinct(Quote.id)).label("tender_count"),
        )
        .outerjoin(Project, Project.company_id == Company.id)
        .outerjoin(Quote, Quote.project_id == Project.id)
        .filter(Company.is_active.is_(True))
        .group_by(Company.id, Company.name, Company.city, Company.logo_url)
        .order_by(func.count(func.distinct(Project.id)).desc(), Company.name.asc())
        .limit(12)
        .all()
    )
    strategic_partners = [
        {
            "id": row.id,
            "name": row.name,
            "city": row.city or "-",
            "project_count": int(row.project_count or 0),
            "tender_count": int(row.tender_count or 0),
            "logo_url": row.logo_url,
        }
        for row in strategic_rows
    ]
    if not strategic_partners:
        strategic_partners.append(
            {
                "id": 0,
                "name": "Demo Stratejik Partner",
                "city": "Istanbul",
                "project_count": 1,
                "tender_count": 1,
                "logo_url": None,
            }
        )

    channel_rows = (
        db.query(
            ChannelOrganization.id,
            ChannelOrganization.name,
            func.count(ChannelReferral.id).label("referral_count"),
            func.coalesce(func.sum(CommissionLedger.amount), 0).label(
                "commission_total"
            ),
        )
        .outerjoin(
            ChannelReferral, ChannelReferral.channel_org_id == ChannelOrganization.id
        )
        .outerjoin(
            CommissionLedger, CommissionLedger.channel_org_id == ChannelOrganization.id
        )
        .filter(ChannelOrganization.is_active.is_(True))
        .group_by(ChannelOrganization.id, ChannelOrganization.name)
        .order_by(
            func.count(ChannelReferral.id).desc(),
            func.coalesce(func.sum(CommissionLedger.amount), 0).desc(),
        )
        .limit(12)
        .all()
    )
    top_channels = []
    for row in channel_rows:
        referral_count = int(row.referral_count or 0)
        commission_total = float(row.commission_total or 0)
        success_score = round((referral_count * 12) + (commission_total / 1000), 1)
        top_channels.append(
            {
                "id": row.id,
                "name": row.name,
                "referral_count": referral_count,
                "commission_total": commission_total,
                "success_score": success_score,
                "logo_url": None,
            }
        )
    top_channels.sort(key=lambda item: item["success_score"], reverse=True)
    if not top_channels:
        top_channels.append(
            {
                "id": 0,
                "name": "Demo Is Ortagi",
                "referral_count": 3,
                "commission_total": 8500.0,
                "success_score": 44.5,
                "logo_url": None,
            }
        )

    return {
        "open_tenders": open_tenders,
        "supplier_pool": supplier_pool,
        "strategic_partners": strategic_partners,
        "top_channels": top_channels,
    }


@router.get("/tenders/{quote_id}/files")
def get_public_tender_files(quote_id: int, db: Session = Depends(get_db)):
    quote = (
        db.query(Quote).filter(Quote.id == quote_id, Quote.is_active.is_(True)).first()
    )
    if not quote:
        return {"files": []}
    project = db.query(Project).filter(Project.id == quote.project_id).first()
    if not project:
        return {"files": []}
    files = (
        db.query(ProjectFile)
        .filter(ProjectFile.project_id == project.id)
        .order_by(ProjectFile.created_at.desc())
        .limit(30)
        .all()
    )
    return {
        "files": [
            {
                "id": item.id,
                "name": item.original_filename or item.filename,
                "type": item.file_type,
                "size": item.file_size,
            }
            for item in files
        ]
    }


@router.get("/tenders/{quote_id}/bidders")
def get_public_tender_bidders(quote_id: int, db: Session = Depends(get_db)):
    quote = (
        db.query(Quote).filter(Quote.id == quote_id, Quote.is_active.is_(True)).first()
    )
    if not quote:
        return {"bidders": []}
    project = db.query(Project).filter(Project.id == quote.project_id).first()
    if not project:
        return {"bidders": []}
    bidders = (
        db.query(Supplier.company_name, Supplier.city)
        .join(ProjectSupplier, ProjectSupplier.supplier_id == Supplier.id)
        .filter(ProjectSupplier.project_id == project.id)
        .order_by(Supplier.company_name.asc())
        .all()
    )
    return {
        "bidders": [
            {"company_name": name, "city": city or "-"} for name, city in bidders
        ]
    }
