"""Sözleşme Yönetimi API Endpoints"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Quote, SupplierQuote, Supplier, User
from api.models.report import Contract
from api.schemas.report import ContractCreate, ContractOut, ContractSign
from api.core.deps import get_current_user
from api.core.time import utcnow

router = APIRouter(prefix="/contracts", tags=["contracts"])


def generate_contract_number(quote_id: int, supplier_id: int) -> str:
    """Benzersiz sözleşme numarası oluştur"""
    timestamp = utcnow().strftime("%Y%m%d%H%M%S")
    return f"CON-{quote_id:05d}-{supplier_id:05d}-{timestamp}"


@router.post("/{quote_id}/{supplier_id}/generate", response_model=ContractOut)
def generate_contract(
    quote_id: int,
    supplier_id: int,
    contract_data: ContractCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sözleşme oluştur ve veritabanına kaydet"""

    quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not quote:
        raise HTTPException(status_code=404, detail="Teklif bulunamadı")

    supplier = db.query(Supplier).filter(Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Tedarikçi bulunamadı")

    supplier_quote = (
        db.query(SupplierQuote)
        .filter(
            SupplierQuote.quote_id == quote_id, SupplierQuote.supplier_id == supplier_id
        )
        .first()
    )
    if not supplier_quote:
        raise HTTPException(status_code=404, detail="Tedarikçi yanıtı bulunamadı")

    try:
        contract_number = generate_contract_number(quote_id, supplier_id)

        contract = Contract(
            quote_id=quote_id,
            supplier_quote_id=supplier_quote.id,
            supplier_id=supplier_id,
            contract_number=contract_number,
            contract_type=contract_data.contract_type,
            total_amount=supplier_quote.total_amount,
            final_amount=supplier_quote.final_amount,
            payment_terms=contract_data.payment_terms,
            delivery_date=contract_data.delivery_date,
            warranty_period=contract_data.warranty_period,
            notes=contract_data.notes,
            status="generated",
        )

        db.add(contract)
        db.commit()
        db.refresh(contract)

        return contract

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500, detail=f"Sözleşme oluşturulamadı: {str(e)}"
        )


@router.post("/{contract_id}/sign", response_model=ContractOut)
def sign_contract(
    contract_id: int,
    sign_data: ContractSign,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Sözleşmeyi imzala"""

    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=404, detail="Sözleşme bulunamadı")

    contract.status = "signed"
    contract.signed_at = utcnow()
    contract.signed_by_id = current_user.id

    db.commit()
    db.refresh(contract)

    return contract


@router.get("/quote/{quote_id}/contracts", response_model=list[ContractOut])
def get_quote_contracts(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Quote'ın tüm sözleşmelerini al"""

    contracts = db.query(Contract).filter(Contract.quote_id == quote_id).all()
    return contracts
