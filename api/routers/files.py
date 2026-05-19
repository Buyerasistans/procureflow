"""Dosya indirme/sunma routeri - ID-bazlı dosya erişimi"""

from fastapi import APIRouter, Depends, HTTPException, status, Query, Header
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
import mimetypes
from urllib.parse import quote

from api.core.deps import get_db
from api.core.security import decode_access_token
from api.models import ProjectFile, User, SupplierUser
from api.services.file_service import FileUploadService


router = APIRouter(prefix="/api/v1/files", tags=["files"])


@router.get("/{file_id}/thumbnail")
async def get_file_thumbnail(file_id: int, db: Session = Depends(get_db)):
    """
    Dosya thumbnail'ı - Genel aşan (token gerektirmeyen)
    Sadece görsel dosyaları için
    """
    project_file = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()

    if not project_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dosya bulunamadi"
        )

    # Sadece görsel dosyaları sun
    if not project_file.file_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Bu dosyanin thumbnail'i yok"
        )

    # Dosya var mı kontrol et
    import os

    if not os.path.exists(project_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya fiziksel olarak bulunamadi",
        )

    # MIME type'ını belirle
    media_type, _ = mimetypes.guess_type(project_file.file_path)
    if not media_type:
        media_type = "image/jpeg"

    # Dosyayı sunan
    return FileResponse(path=project_file.file_path, media_type=media_type)


@router.get("/{file_id}")
async def download_file(
    file_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
    token: str = Query(None),
):
    """
    Dosyayı ID'ye göre indir/sun.
    Token'ı header'dan (Authorization: Bearer) veya query param'dan alabilir.
    Office 365 online preview için query param token desteği.
    """
    current_user = None

    def resolve_authenticated_principal(raw_token: str):
        try:
            payload = decode_access_token(raw_token)
        except Exception:
            return None

        role = payload.get("role")
        subject = payload.get("sub")
        if not subject:
            return None

        # Supplier token: sub=email
        if role == "supplier":
            return (
                db.query(SupplierUser)
                .filter(SupplierUser.email == str(subject), SupplierUser.is_active)
                .first()
            )

        # Admin/normal token: sub=user_id
        try:
            user_id = int(subject)
        except (TypeError, ValueError):
            return None
        return db.query(User).filter_by(id=user_id).first()

    # Header'dan token al (Authorization: Bearer {token})
    if authorization and authorization.startswith("Bearer "):
        bearer_token = authorization.split(" ")[1]
        current_user = resolve_authenticated_principal(bearer_token)

    # Query param'dan token al (fallback)
    if not current_user and token:
        current_user = resolve_authenticated_principal(token)

    # Authenticate check
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    # Dosyayı veritabanından bul
    project_file = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()

    if not project_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dosya bulunamadi"
        )

    # Dosya var mı kontrol et
    import os

    if not os.path.exists(project_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya fiziksel olarak bulunamadi",
        )

    # MIME type'ını belirle - mimetypes modülü kullan (daha güvenilir)
    media_type, _ = mimetypes.guess_type(project_file.file_path)
    if not media_type:
        media_type = FileUploadService.get_file_media_type(
            project_file.original_filename
        )

    # Content-Disposition header'ı hazırla
    # RFC 5987: ASCII fallback + UTF-8 encoded filename
    original_filename = project_file.original_filename

    # ASCII fallback - Türkçe karakterleri kaldır, sadece ASCII karakterler tut
    ascii_filename = ""
    for char in original_filename:
        if ord(char) < 128:
            ascii_filename += char
    if not ascii_filename:
        # Eğer hiç ASCII karakter yoksa generic adı kullan
        import os

        _, ext = os.path.splitext(original_filename)
        ascii_filename = f"file_{project_file.id}{ext}"

    # UTF-8 encoded version (RFC 5987)
    encoded_filename = quote(original_filename, safe="")

    # Header: önce ASCII fallback (eski browserlar için), sonra UTF-8 version (yeni browserlar için)
    disposition_header = f"attachment; filename=\"{ascii_filename}\"; filename*=UTF-8''{encoded_filename}"

    # Dosyayı sunan - content-disposition header'ı da ekle
    return FileResponse(
        path=project_file.file_path,
        media_type=media_type,
        headers={"Content-Disposition": disposition_header},
    )


@router.get("/{file_id}/open")
async def open_file(
    file_id: int,
    db: Session = Depends(get_db),
    authorization: str = Header(None),
    token: str = Query(None),
):
    """
    Dosyayı Windows'un varsayılan programıyla aç.
    Sadece Windows'ta çalışır.
    """
    current_user = None

    def resolve_authenticated_principal(raw_token: str):
        try:
            payload = decode_access_token(raw_token)
        except Exception:
            return None

        role = payload.get("role")
        subject = payload.get("sub")
        if not subject:
            return None

        if role == "supplier":
            return (
                db.query(SupplierUser)
                .filter(SupplierUser.email == str(subject), SupplierUser.is_active)
                .first()
            )

        try:
            user_id = int(subject)
        except (TypeError, ValueError):
            return None
        return db.query(User).filter_by(id=user_id).first()

    # Header'dan token al
    if authorization and authorization.startswith("Bearer "):
        bearer_token = authorization.split(" ")[1]
        current_user = resolve_authenticated_principal(bearer_token)

    # Query param'dan token al
    if not current_user and token:
        current_user = resolve_authenticated_principal(token)

    # Authenticate check
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated"
        )

    # Dosyayı veritabanından bul
    project_file = db.query(ProjectFile).filter(ProjectFile.id == file_id).first()

    if not project_file:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Dosya bulunamadi"
        )

    # Dosya var mı kontrol et
    import os

    if not os.path.exists(project_file.file_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Dosya fiziksel olarak bulunamadi",
        )

    # Windows'ta os.startfile() ile dosyayı aç
    try:
        os.startfile(project_file.file_path)
        return {"message": "Dosya açılıyor..."}
    except AttributeError:
        # Linux/Mac'te çalıştırılırsa
        raise HTTPException(
            status_code=status.HTTP_501_NOT_IMPLEMENTED,
            detail="Bu özellik sadece Windows'ta desteklenir",
        )
