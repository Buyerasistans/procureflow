from __future__ import annotations

import json
import logging
from pathlib import Path
from uuid import uuid4

from tempfile import NamedTemporaryFile, TemporaryDirectory
from api.services.cad_convert import (
    convert_dwg_to_dxf,
    CADConversionError,
    can_convert_dwg,
    get_dwg_converter_diagnostics,
)

from fastapi import APIRouter, File, HTTPException, UploadFile, status, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from api.core.deps import get_current_user
from api.database import get_db
from api.models import (
    DiscoveryLabAnswerAudit,
    DiscoveryLabEvent,
    DiscoveryLabSession,
    Project,
    Quote,
    QuoteItem,
    QuoteStatus,
    Tenant,
    User,
)
from api.services.bom_engine import generate_bom_from_metadata
from api.services.extractor import DWGExtractor

router = APIRouter(prefix="/ai-lab", tags=["AI Laboratuvari"])
logger = logging.getLogger(__name__)


class DiscoveryLabDecisionIn(BaseModel):
    session_id: str
    question_id: int
    decision: str


class DiscoveryLabAnswerIn(BaseModel):
    session_id: str
    question_id: int
    answer_text: str
    question_text: str | None = None
    decision: str | None = None
    rationale: str | None = None


class DiscoveryLabBomSelectionIn(BaseModel):
    session_id: str
    item_key: str
    selected: bool


class DiscoveryLabConfirmIn(BaseModel):
    session_id: str
    project_id: int | None = None
    selected_bom_item_keys: list[str]


def _safe_error_detail(*, code: str, message: str, request_id: str) -> dict[str, str]:
    return {"code": code, "message": message, "request_id": request_id}


def _raise_discovery_lab_error(
    *,
    status_code: int,
    code: str,
    message: str,
    request_id: str,
    reason: str | None = None,
) -> None:
    log_payload = {"request_id": request_id, "error_code": code}
    if reason:
        log_payload["reason"] = reason
    logger.warning("discovery_lab_user_safe_error", extra=log_payload)
    raise HTTPException(
        status_code=status_code,
        detail=_safe_error_detail(code=code, message=message, request_id=request_id),
    )


def _filter_discovery_lab_sessions(
    db: Session,
    *,
    status_filter: str | None = None,
    project_query: str | None = None,
    user_query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
) -> list[DiscoveryLabSession]:
    query = db.query(DiscoveryLabSession)
    normalized_status_filter = (status_filter or "all").strip().lower()
    if normalized_status_filter and normalized_status_filter != "all":
        query = query.filter(DiscoveryLabSession.status == normalized_status_filter)

    normalized_project_query = (project_query or "").strip().lower()
    if normalized_project_query:
        session_candidates = query.order_by(
            DiscoveryLabSession.updated_at.desc(), DiscoveryLabSession.id.desc()
        ).all()
        session_candidates = [
            row
            for row in session_candidates
            if normalized_project_query in str(row.selected_project_name or "").lower()
        ]
    else:
        session_candidates = query.order_by(
            DiscoveryLabSession.updated_at.desc(), DiscoveryLabSession.id.desc()
        ).all()

    normalized_search = (search or "").strip().lower()
    if normalized_search:
        session_candidates = [
            row
            for row in session_candidates
            if normalized_search in str(row.source_filename or "").lower()
            or normalized_search in str(row.created_by_email or "").lower()
            or normalized_search in str(row.session_id or "").lower()
        ]

    normalized_user_query = (user_query or "").strip().lower()
    if normalized_user_query:
        session_candidates = [
            row
            for row in session_candidates
            if normalized_user_query in str(row.created_by_email or "").lower()
            or normalized_user_query
            in str(
                json.loads(row.procurement_payload_json or "{}").get(
                    "confirmed_by_email"
                )
                or ""
            ).lower()
        ]

    normalized_date_from = (date_from or "").strip()
    if normalized_date_from:
        session_candidates = [
            row
            for row in session_candidates
            if str(row.updated_at or row.created_at).startswith(normalized_date_from)
            or str(row.created_at).startswith(normalized_date_from)
            or str(row.updated_at).split(" ")[0] >= normalized_date_from
        ]

    normalized_date_to = (date_to or "").strip()
    if normalized_date_to:
        session_candidates = [
            row
            for row in session_candidates
            if str(row.created_at).split(" ")[0] <= normalized_date_to
            and str(row.updated_at).split(" ")[0] <= normalized_date_to
        ]

    return session_candidates


def _is_platform_staff(current_user: User) -> bool:
    return current_user.system_role in {
        "super_admin",
        "platform_support",
        "platform_operator",
    }


def _can_view_converter_health(current_user: User) -> bool:
    return _is_platform_staff(current_user) or current_user.system_role in {
        "tenant_owner",
        "tenant_admin",
    }


def _can_manage_project(current_user: User, project: Project) -> bool:
    if not current_user.is_active:
        return False
    if _is_platform_staff(current_user):
        return True
    if (
        current_user.tenant_id is not None
        and project.tenant_id != current_user.tenant_id
    ):
        return False
    if current_user.system_role in {"tenant_owner", "tenant_admin"}:
        return True
    return any(user_project.id == project.id for user_project in current_user.projects)


def _ensure_session_access(
    db: Session, *, session_row: DiscoveryLabSession, current_user: User
) -> None:
    if _is_platform_staff(current_user):
        return
    if session_row.created_by_user_id == current_user.id:
        return
    if session_row.selected_project_id:
        project = (
            db.query(Project)
            .filter(Project.id == session_row.selected_project_id)
            .first()
        )
        if project and _can_manage_project(current_user, project):
            return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Bu Discovery Lab oturumuna erişim yetkiniz yok",
    )


def _get_or_create_discovery_lab_project(
    db: Session, *, current_user: User
) -> tuple[Project, User]:
    db_user = db.get(User, current_user.id)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aktarım kullanıcısı bulunamadı",
        )
    tenant_id = current_user.tenant_id
    project_code = "DISCOVERY-LAB" if tenant_id is not None else f"DL-USER-{current_user.id}"
    query = db.query(Project).filter(
        Project.code == project_code,
        Project.is_active.is_(True),
    )
    if tenant_id is None:
        query = query.filter(
            Project.tenant_id.is_(None),
            Project.created_by_id == current_user.id,
        )
    else:
        query = query.filter(Project.tenant_id == tenant_id)

    project = query.order_by(Project.id.asc()).first()
    if project:
        if not any(person.id == db_user.id for person in project.personnel):
            project.personnel.append(db_user)
            db.flush()
        return project, db_user

    project = Project(
        name="Discovery Lab Aktarım Projesi",
        description="Discovery Lab otomatik RFQ aktarımı için oluşturulan varsayılan proje.",
        code=project_code,
        budget=None,
        project_type="merkez",
        is_active=True,
        tenant_id=tenant_id,
        created_by_id=current_user.id,
    )
    project.personnel.append(db_user)
    db.add(project)
    db.flush()
    return project, db_user


def _resolve_procurement_context(
    db: Session, *, current_user: User, project_id: int | None
) -> tuple[Project, User]:
    if project_id is None:
        return _get_or_create_discovery_lab_project(db, current_user=current_user)

    project = (
        db.query(Project)
        .filter(Project.id == project_id, Project.is_active.is_(True))
        .first()
    )
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Aktif satın alma projesi bulunamadı",
        )
    if not _can_manage_project(current_user, project):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu proje için Discovery Lab aktarım yetkiniz yok",
        )
    return project, current_user


def _create_procurement_quote(
    db: Session,
    *,
    session_row: DiscoveryLabSession,
    metadata: dict,
    selected_bom_items: list[dict],
    project: Project,
    user: User,
) -> Quote:
    filename = (
        session_row.source_filename
        or metadata.get("proje_ozet", {}).get("kaynak_dosya")
        or "Discovery Lab"
    )
    quote = Quote(
        tenant_id=project.tenant_id,
        user_id=user.id,
        project_id=project.id,
        created_by_id=user.id,
        title=f"Discovery Lab RFQ - {filename}",
        description="Discovery Lab teknik onayından satın alma kuyruğuna aktarılan keşif kaydı.",
        status=QuoteStatus.DRAFT,
        company_name="ProcureFlow Discovery Lab",
        company_contact_name=user.full_name or user.email,
        company_contact_phone=user.company_phone or user.personal_phone or "-",
        company_contact_email=user.email,
        total_amount=0,
        created_by=user.id,
        department_id=getattr(user, "department_id", None),
        assigned_to_id=user.id,
    )
    db.add(quote)
    db.flush()

    grouped_items: dict[str, dict] = {}
    for item in selected_bom_items:
        group_key = item.get("group_key") or item.get("source_layer") or "discovery-lab"
        group_name = item.get("group_name") or item.get("source_layer") or "Discovery Lab Kalemleri"
        grouped_items.setdefault(str(group_key), {"name": group_name, "items": []})
        grouped_items[str(group_key)]["items"].append(item)

    sequence = 1
    for group_index, (group_key, group_payload) in enumerate(grouped_items.items(), start=1):
        db.add(
            QuoteItem(
                quote_id=quote.id,
                line_number=str(group_index),
                category_code="DISCOVERY_LAB",
                category_name="Discovery Lab",
                description=str(group_payload["name"]),
                group_key=str(group_key),
                is_group_header=True,
                unit="",
                quantity=0,
                unit_price=None,
                total_price=None,
                notes="Discovery Lab reçete grubu",
                sequence=sequence,
            )
        )
        sequence += 1
        for item_index, item in enumerate(group_payload["items"], start=1):
            db.add(
                QuoteItem(
                    quote_id=quote.id,
                    line_number=f"{group_index}.{item_index}",
                    category_code="DISCOVERY_LAB",
                    category_name=str(group_payload["name"]),
                    description=item.get("material") or "İsimsiz malzeme",
                    group_key=str(group_key),
                    is_group_header=False,
                    unit=item.get("unit") or "adet",
                    quantity=float(item.get("quantity") or 0),
                    unit_price=None,
                    total_price=None,
                    notes=f"Kaynak katman: {item.get('source_layer')}",
                    sequence=sequence,
                )
            )
            sequence += 1

    if not grouped_items:
        db.add(
            QuoteItem(
                quote_id=quote.id,
                line_number="1",
                category_code="DISCOVERY_LAB",
                category_name="Discovery Lab",
                description="Discovery Lab teknik keşif kalemleri",
                group_key="discovery-lab",
                is_group_header=True,
                unit="",
                quantity=0,
                unit_price=None,
                total_price=None,
                notes="Seçili BOM kalemi bulunamadı.",
                sequence=1,
            )
        )

    return quote


def _get_session_or_404(db: Session, session_id: str) -> DiscoveryLabSession:
    session_row = (
        db.query(DiscoveryLabSession)
        .filter(DiscoveryLabSession.session_id == session_id)
        .first()
    )
    if not session_row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Discovery Lab oturumu bulunamadı",
        )
    return session_row


def _create_event(
    db: Session,
    *,
    session_row: DiscoveryLabSession,
    event_type: str,
    target_key: str,
    decision: str | None = None,
    payload: dict | None = None,
) -> DiscoveryLabEvent:
    event = DiscoveryLabEvent(
        session_ref_id=session_row.id,
        event_type=event_type,
        target_key=target_key,
        decision=decision,
        payload_json=json.dumps(payload or {}, ensure_ascii=False),
    )
    db.add(event)
    return event


def _serialize_timeline(event_rows: list[DiscoveryLabEvent]) -> list[dict]:
    timeline = []
    for event in event_rows:
        payload = json.loads(event.payload_json or "{}")
        timeline.append(
            {
                "timestamp": event.created_at,
                "type": event.event_type,
                "title": {
                    "analysis_created": "Analiz Oluşturuldu",
                    "bom_selection": "BOM Seçimi Güncellendi",
                    "ai_decision": "AI Teknik Kararı Kaydedildi",
                    "user_answer": "Kullanıcı Yanıtı Kaydedildi",
                    "technical_lock": "Teknik Kilit ve Satın Alma Aktarımı",
                }.get(event.event_type, event.event_type),
                "actor": payload.get("actor_name")
                or payload.get("actor_email")
                or "Discovery Lab",
                "details": {
                    "target_key": event.target_key,
                    "decision": event.decision,
                    **payload,
                },
            }
        )
    return timeline


def _serialize_answer_audit(db: Session, audit_row: DiscoveryLabAnswerAudit) -> dict:
    project_name = (
        audit_row.session.selected_project_name if audit_row.session else None
    )
    project_id = audit_row.session.selected_project_id if audit_row.session else None
    quote_id = audit_row.session.procurement_quote_id if audit_row.session else None
    tenant_id = None
    tenant_name = None
    quote_status = None
    if quote_id:
        quote_row = db.query(Quote).filter(Quote.id == quote_id).first()
        tenant_id = quote_row.tenant_id if quote_row else None
        quote_status = (
            quote_row.status.value
            if quote_row and getattr(quote_row, "status", None) is not None
            else None
        )
    if tenant_id is None and project_id:
        project_row = db.query(Project).filter(Project.id == project_id).first()
        tenant_id = project_row.tenant_id if project_row else None
    if tenant_id is not None:
        tenant_row = db.query(Tenant).filter(Tenant.id == tenant_id).first()
        tenant_name = (
            (tenant_row.brand_name or tenant_row.legal_name) if tenant_row else None
        )
    return {
        "id": audit_row.id,
        "session_id": audit_row.session.session_id if audit_row.session else None,
        "question_id": audit_row.question_id,
        "question_text": audit_row.question_text,
        "answer_text": audit_row.answer_text,
        "decision": audit_row.decision,
        "rationale": audit_row.rationale,
        "created_by_email": audit_row.created_by_email,
        "created_at": audit_row.created_at,
        "source_filename": audit_row.session.source_filename
        if audit_row.session
        else None,
        "project_id": project_id,
        "project_name": project_name,
        "quote_id": quote_id,
        "quote_status": quote_status,
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
    }


def _build_fallback_ai_report(metadata: dict) -> dict:
    katmanlar = metadata.get("katmanlar") or []
    duvar_katmanlari = [
        item for item in katmanlar if "DUVAR" in str(item.get("layer_name", "")).upper()
    ]
    islak_hacim_var = any(
        "ISLAK" in str(item.get("layer_name", "")).upper() for item in katmanlar
    )
    zemin_seramik_var = any(
        "ZEMIN_SERAMIK" in str(item.get("layer_name", "")).upper() for item in katmanlar
    )

    karar_destek_sorulari = []
    if islak_hacim_var and not zemin_seramik_var:
        karar_destek_sorulari.append(
            {
                "id": 1,
                "soru": "Islak hacim için zemin seramik veya su yalıtımı katmanı ekleyelim mi?",
                "neden": "PF_ ıslak hacim duvarları bulundu ancak zeminde tamamlayıcı katman sinyali görülmedi.",
            }
        )
    if duvar_katmanlari:
        karar_destek_sorulari.append(
            {
                "id": len(karar_destek_sorulari) + 1,
                "soru": "Duvar katmanları için alt reçete kalemleri otomatik tamamlansın mı?",
                "neden": "Duvar metrajları bulundu; boya, astar ve yardımcı sarf kalemleri eksik olabilir.",
            }
        )

    return {
        "teknik_analiz": f"{len(katmanlar)} PF katmanı ve {len(metadata.get('bloklar') or [])} PF blok grubu analiz edildi.",
        "kritik_uyarilar": [],
        "karar_destek_sorulari": karar_destek_sorulari,
        "recete_onerileri": [],
    }


@router.post("/analyze")
async def start_ai_audit(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    request_id = uuid4().hex
    suffix = Path(file.filename or "upload.dxf").suffix.lower() or ".dxf"
    if suffix not in {".dxf", ".dwg"}:
        _raise_discovery_lab_error(
            status_code=status.HTTP_400_BAD_REQUEST,
            code="UNSUPPORTED_CAD_EXTENSION",
            message="Yalnızca .dwg veya .dxf dosyaları desteklenir.",
            request_id=request_id,
            reason=f"suffix={suffix}",
        )

    temp_path: str | None = None
    temp_dir_ctx: TemporaryDirectory[str] | None = None
    source_for_extractor: Path | None = None

    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        uploaded_path = Path(temp_path)

        if suffix == ".dwg":
            source_for_extractor = uploaded_path
            extractor = DWGExtractor(str(source_for_extractor))
            metadata = extractor.extract_metadata()

            if not metadata:
                ok, reason = can_convert_dwg()
                if not ok:
                    _raise_discovery_lab_error(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        code="DWG_CONVERTER_UNAVAILABLE",
                        message=(
                            "DWG dosyasının metadata çıkarılması başarısız oldu. "
                            "Sunucuda DWG->DXF dönüştürme aracı bulunamadı. "
                            "Lütfen dosyayı DXF olarak yükleyin veya destek ekibine iletin."
                        ),
                        request_id=request_id,
                        reason=reason,
                    )

                temp_dir_ctx = TemporaryDirectory()
                try:
                    source_for_extractor = convert_dwg_to_dxf(
                        uploaded_path,
                        temp_dir_ctx.name,
                        output_version="ACAD2013",
                    )
                except CADConversionError as conv_err:
                    _raise_discovery_lab_error(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        code="DWG_CONVERSION_FAILED",
                        message=(
                            "DWG dosyası DXF formatına dönüştürülemedi. "
                            "Lütfen dosyayı DXF olarak yükleyin veya destek ekibine iletin."
                        ),
                        request_id=request_id,
                        reason=str(conv_err),
                    )

                extractor = DWGExtractor(str(source_for_extractor))
                metadata = extractor.extract_metadata()
        else:
            source_for_extractor = uploaded_path
            extractor = DWGExtractor(str(source_for_extractor))
            metadata = extractor.extract_metadata()
        if not metadata:
            _raise_discovery_lab_error(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                code="CAD_METADATA_EXTRACTION_FAILED",
                message=(
                    "CAD dosyasından metadata çıkarılamadı. "
                    "Lütfen dosyanın geçerli olduğunu kontrol edip tekrar deneyin."
                ),
                request_id=request_id,
            )

        try:
            from api.services.ai_engine import AIKeşifAsistani

            ai_assistant = AIKeşifAsistani(api_key="")
            ai_report = await ai_assistant.analiz_et(metadata)
        except Exception:
            ai_report = _build_fallback_ai_report(metadata)

        bom = generate_bom_from_metadata(metadata)
        session_id = uuid4().hex
        session_row = DiscoveryLabSession(
            session_id=session_id,
            source_filename=file.filename,
            status="analyzed",
            created_by_user_id=current_user.id,
            created_by_email=current_user.email,
            metadata_json=json.dumps(metadata, ensure_ascii=False),
            ai_report_json=json.dumps(ai_report, ensure_ascii=False),
            bom_json=json.dumps(bom, ensure_ascii=False),
        )
        db.add(session_row)
        db.flush()
        _create_event(
            db,
            session_row=session_row,
            event_type="analysis_created",
            target_key=session_id,
            decision="analyzed",
            payload={
                "actor_id": current_user.id,
                "actor_email": current_user.email,
                "actor_name": current_user.full_name,
                "source_filename": file.filename,
            },
        )
        db.commit()

        return {
            "status": "success",
            "session_id": session_id,
            "metadata": metadata,
            "ai_report": ai_report,
            "bom": bom,
        }
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
        if temp_dir_ctx:
            temp_dir_ctx.cleanup()


@router.post("/bom-selection")
def save_bom_selection(
    payload: DiscoveryLabBomSelectionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_row = _get_session_or_404(db, payload.session_id)
    _ensure_session_access(db, session_row=session_row, current_user=current_user)
    _create_event(
        db,
        session_row=session_row,
        event_type="bom_selection",
        target_key=payload.item_key,
        decision="selected" if payload.selected else "deselected",
        payload={
            "selected": payload.selected,
            "actor_id": current_user.id,
            "actor_email": current_user.email,
            "actor_name": current_user.full_name,
        },
    )
    db.commit()
    return {"status": "success", "session_id": session_row.session_id}


@router.post("/decision")
def save_ai_decision(
    payload: DiscoveryLabDecisionIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_row = _get_session_or_404(db, payload.session_id)
    _ensure_session_access(db, session_row=session_row, current_user=current_user)
    normalized_decision = payload.decision.lower()
    if normalized_decision not in {"approved", "ignored"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz karar"
        )

    _create_event(
        db,
        session_row=session_row,
        event_type="ai_decision",
        target_key=f"question:{payload.question_id}",
        decision=normalized_decision,
        payload={
            "question_id": payload.question_id,
            "actor_id": current_user.id,
            "actor_email": current_user.email,
            "actor_name": current_user.full_name,
        },
    )
    db.commit()
    return {"status": "success", "session_id": session_row.session_id}


@router.post("/answer")
def save_ai_answer(
    payload: DiscoveryLabAnswerIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_row = _get_session_or_404(db, payload.session_id)
    _ensure_session_access(db, session_row=session_row, current_user=current_user)
    answer_text = payload.answer_text.strip()
    if not answer_text:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Kullanıcı yanıtı boş olamaz",
        )

    normalized_decision = payload.decision.strip().lower() if payload.decision else None
    if normalized_decision and normalized_decision not in {
        "approved",
        "ignored",
        "needs_review",
    }:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Geçersiz cevap kararı"
        )

    audit_row = DiscoveryLabAnswerAudit(
        session_ref_id=session_row.id,
        question_id=payload.question_id,
        question_text=(payload.question_text or None),
        answer_text=answer_text,
        decision=normalized_decision,
        rationale=(payload.rationale.strip() if payload.rationale else None),
        created_by_user_id=current_user.id,
        created_by_email=current_user.email,
    )
    db.add(audit_row)
    db.flush()
    _create_event(
        db,
        session_row=session_row,
        event_type="user_answer",
        target_key=f"question:{payload.question_id}",
        decision=normalized_decision or "answered",
        payload={
            "question_id": payload.question_id,
            "question_text": payload.question_text,
            "answer_text": answer_text,
            "rationale": payload.rationale,
            "actor_id": current_user.id,
            "actor_email": current_user.email,
            "actor_name": current_user.full_name,
        },
    )
    db.commit()

    return {
        "status": "success",
        "session_id": session_row.session_id,
        "audit_id": audit_row.id,
    }


@router.post("/confirm")
def confirm_discovery_lab(
    payload: DiscoveryLabConfirmIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_row = _get_session_or_404(db, payload.session_id)
    _ensure_session_access(db, session_row=session_row, current_user=current_user)
    metadata = json.loads(session_row.metadata_json)
    bom = json.loads(session_row.bom_json)
    project, user = _resolve_procurement_context(
        db, current_user=current_user, project_id=payload.project_id
    )

    selected_bom_items = [
        item
        for index, item in enumerate(bom)
        if f"{item.get('source_layer')}-{item.get('material')}-{index}"
        in payload.selected_bom_item_keys
    ]
    if not selected_bom_items and bom:
        selected_bom_items = bom
    event_rows = (
        db.query(DiscoveryLabEvent)
        .filter(DiscoveryLabEvent.session_ref_id == session_row.id)
        .order_by(DiscoveryLabEvent.id.asc())
        .all()
    )
    approved_questions = [
        row.target_key
        for row in event_rows
        if row.event_type == "ai_decision" and row.decision == "approved"
    ]

    transfer_id = f"DL-{uuid4().hex[:10].upper()}"
    procurement_quote = _create_procurement_quote(
        db,
        session_row=session_row,
        metadata=metadata,
        selected_bom_items=selected_bom_items,
        project=project,
        user=user,
    )
    procurement_payload = {
        "transfer_id": transfer_id,
        "source_filename": session_row.source_filename,
        "metadata_summary": metadata.get("proje_ozet") or {},
        "selected_bom_items": selected_bom_items,
        "approved_questions": approved_questions,
        "project_id": project.id,
        "project_name": project.name,
        "confirmed_by_user_id": user.id,
        "confirmed_by_email": user.email,
        "quote_id": procurement_quote.id,
        "status": "queued_for_procurement",
    }
    session_row.status = "technical_locked"
    session_row.selected_project_id = project.id
    session_row.selected_project_name = project.name
    session_row.procurement_payload_json = json.dumps(
        procurement_payload, ensure_ascii=False
    )
    session_row.procurement_quote_id = procurement_quote.id
    _create_event(
        db,
        session_row=session_row,
        event_type="technical_lock",
        target_key=transfer_id,
        decision="confirmed",
        payload={
            **procurement_payload,
            "actor_id": current_user.id,
            "actor_email": current_user.email,
            "actor_name": current_user.full_name,
        },
    )
    db.commit()

    return {
        "status": "success",
        "session_id": session_row.session_id,
        "transfer": procurement_payload,
    }


@router.get("/health/converter")
def get_converter_health(
    current_user: User = Depends(get_current_user),
):
    request_id = uuid4().hex
    if not _can_view_converter_health(current_user):
        logger.warning(
            "discovery_lab_converter_health_forbidden",
            extra={
                "request_id": request_id,
                "error_code": "CONVERTER_HEALTH_FORBIDDEN",
                "reason": f"user_id={current_user.id}",
            },
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=_safe_error_detail(
                code="CONVERTER_HEALTH_FORBIDDEN",
                message="Converter sağlık bilgisini görüntüleme yetkiniz yok.",
                request_id=request_id,
            ),
        )

    diagnostics = get_dwg_converter_diagnostics()
    logger.info(
        "discovery_lab_converter_health_checked",
        extra={
            "request_id": request_id,
            "error_code": "CONVERTER_HEALTH_CHECK",
            "reason": diagnostics.get("reason") or diagnostics.get("resolver_source"),
        },
    )
    return {
        "converter_found": bool(diagnostics["converter_found"]),
        "resolver_source": diagnostics["resolver_source"],
        "executable_name": diagnostics["executable_name"],
        "request_id": request_id,
    }


@router.get("/admin/sessions")
def list_discovery_lab_sessions(
    limit: int = 6,
    status_filter: str | None = None,
    project_query: str | None = None,
    user_query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_platform_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform izleme yetkisi gerekli",
        )

    session_candidates = _filter_discovery_lab_sessions(
        db,
        status_filter=status_filter,
        project_query=project_query,
        user_query=user_query,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )

    session_rows = session_candidates[: max(min(limit, 20), 1)]
    items = []
    for session_row in session_rows:
        latest_event = (
            db.query(DiscoveryLabEvent)
            .filter(DiscoveryLabEvent.session_ref_id == session_row.id)
            .order_by(DiscoveryLabEvent.id.desc())
            .first()
        )
        latest_payload = (
            json.loads(latest_event.payload_json or "{}") if latest_event else {}
        )
        procurement_payload = json.loads(session_row.procurement_payload_json or "{}")
        items.append(
            {
                "session_id": session_row.session_id,
                "source_filename": session_row.source_filename,
                "status": session_row.status,
                "quote_id": session_row.procurement_quote_id,
                "project_id": session_row.selected_project_id,
                "project_name": session_row.selected_project_name
                or procurement_payload.get("project_name"),
                "created_by_email": session_row.created_by_email,
                "confirmed_by_email": procurement_payload.get("confirmed_by_email"),
                "created_at": session_row.created_at,
                "updated_at": session_row.updated_at,
                "latest_event_title": {
                    "analysis_created": "Analiz Oluşturuldu",
                    "bom_selection": "BOM Seçimi Güncellendi",
                    "ai_decision": "AI Teknik Kararı Kaydedildi",
                    "user_answer": "Kullanıcı Yanıtı Kaydedildi",
                    "technical_lock": "Teknik Kilit ve Satın Alma Aktarımı",
                }.get(latest_event.event_type, latest_event.event_type)
                if latest_event
                else "Kayıt bekleniyor",
                "latest_actor": latest_payload.get("actor_name")
                or latest_payload.get("actor_email"),
            }
        )

    return {"items": items}


@router.get("/admin/summary")
def get_discovery_lab_summary(
    status_filter: str | None = None,
    project_query: str | None = None,
    user_query: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_platform_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform izleme yetkisi gerekli",
        )

    session_candidates = _filter_discovery_lab_sessions(
        db,
        status_filter=status_filter,
        project_query=project_query,
        user_query=user_query,
        date_from=date_from,
        date_to=date_to,
        search=search,
    )
    unique_projects = {
        str(
            row.selected_project_name
            or json.loads(row.procurement_payload_json or "{}").get("project_name")
            or ""
        ).strip()
        for row in session_candidates
        if str(
            row.selected_project_name
            or json.loads(row.procurement_payload_json or "{}").get("project_name")
            or ""
        ).strip()
    }

    return {
        "total_sessions": len(session_candidates),
        "locked_sessions": sum(
            1 for row in session_candidates if row.status == "technical_locked"
        ),
        "quote_ready_sessions": sum(
            1 for row in session_candidates if row.procurement_quote_id is not None
        ),
        "active_project_count": len(unique_projects),
        "answer_audit_count": (
            db.query(DiscoveryLabAnswerAudit)
            .join(
                DiscoveryLabSession,
                DiscoveryLabAnswerAudit.session_ref_id == DiscoveryLabSession.id,
            )
            .count()
        ),
    }


@router.get("/admin/answers")
def list_discovery_lab_answer_audits(
    limit: int = 8,
    session_id: str | None = None,
    project_query: str | None = None,
    user_query: str | None = None,
    decision: str | None = None,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not _is_platform_staff(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Platform izleme yetkisi gerekli",
        )

    query = (
        db.query(DiscoveryLabAnswerAudit)
        .join(
            DiscoveryLabSession,
            DiscoveryLabAnswerAudit.session_ref_id == DiscoveryLabSession.id,
        )
        .order_by(
            DiscoveryLabAnswerAudit.created_at.desc(), DiscoveryLabAnswerAudit.id.desc()
        )
    )

    normalized_session_id = (session_id or "").strip()
    if normalized_session_id:
        query = query.filter(DiscoveryLabSession.session_id == normalized_session_id)

    answer_rows = query.all()
    normalized_project_query = (project_query or "").strip().lower()
    if normalized_project_query:
        answer_rows = [
            row
            for row in answer_rows
            if normalized_project_query
            in str(row.session.selected_project_name if row.session else "").lower()
        ]

    normalized_user_query = (user_query or "").strip().lower()
    if normalized_user_query:
        answer_rows = [
            row
            for row in answer_rows
            if normalized_user_query in str(row.created_by_email or "").lower()
        ]

    normalized_decision = (decision or "").strip().lower()
    if normalized_decision:
        answer_rows = [
            row
            for row in answer_rows
            if normalized_decision == str(row.decision or "").lower()
        ]

    normalized_search = (search or "").strip().lower()
    if normalized_search:
        answer_rows = [
            row
            for row in answer_rows
            if normalized_search in str(row.question_text or "").lower()
            or normalized_search in str(row.answer_text or "").lower()
            or normalized_search in str(row.created_by_email or "").lower()
            or normalized_search
            in str(row.session.session_id if row.session else "").lower()
        ]

    items = [
        _serialize_answer_audit(db, row)
        for row in answer_rows[: max(min(limit, 20), 1)]
    ]
    return {"items": items}


@router.get("/{session_id}/timeline")
def get_discovery_lab_timeline(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session_row = _get_session_or_404(db, session_id)
    _ensure_session_access(db, session_row=session_row, current_user=current_user)
    event_rows = (
        db.query(DiscoveryLabEvent)
        .filter(DiscoveryLabEvent.session_ref_id == session_row.id)
        .order_by(DiscoveryLabEvent.id.asc())
        .all()
    )

    return {
        "session_id": session_row.session_id,
        "status": session_row.status,
        "quote_id": session_row.procurement_quote_id,
        "timeline": _serialize_timeline(event_rows),
    }
