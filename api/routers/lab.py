from __future__ import annotations

from pathlib import Path
from tempfile import NamedTemporaryFile

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from api.services.ai_engine import AIKesifAsistani
from api.services.bom_engine import generate_bom_from_metadata
from api.services.extractor import DWGExtractor

router = APIRouter(prefix="/ai-lab", tags=["AI Laboratuvari"])


@router.post("/process-dwg")
async def process_dwg(file: UploadFile = File(...)):
    suffix = Path(file.filename or "upload.dxf").suffix.lower() or ".dxf"
    if suffix not in {".dwg", ".dxf"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Yalnizca .dwg veya .dxf dosyalari desteklenir",
        )

    temp_path: str | None = None
    try:
        with NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
            temp_path = temp_file.name
            temp_file.write(await file.read())

        extractor = DWGExtractor(temp_path)
        metadata = extractor.extract_metadata()
        if not metadata:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Dosya islenemedi",
            )

        ai_report = await AIKesifAsistani().analiz_et(metadata)
        bom_items = generate_bom_from_metadata(metadata)

        return {
            "status": "success",
            "data": metadata,
            "metadata": metadata,
            "ai_report": ai_report,
            "bom": bom_items,
        }
    finally:
        if temp_path:
            Path(temp_path).unlink(missing_ok=True)
