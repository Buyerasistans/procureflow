# services/file_service.py
from pathlib import Path


class FileUploadService:
    """Proje dosya yönetimi servisi - Şirket/Proje kategorilendirmeli"""

    # Temel depolama klasörü
    BASE_UPLOAD_DIR = Path(__file__).parent.parent / "uploads"

    # İzin verilen dosya tipleri
    ALLOWED_EXTENSIONS = {
        # Dokümantasyon
        ".txt",
        ".pdf",
        ".docx",
        ".doc",
        # Görseller
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".bmp",
        ".webp",
        # Sıkıştırılmış
        ".zip",
        ".rar",
        ".7z",
        ".tar",
        ".gz",
        # Office
        ".xlsx",
        ".xls",
        ".ppt",
        ".pptx",
        # Video
        ".mp4",
        ".avi",
        ".mov",
        ".mkv",
        # Diğer
        ".csv",
        ".json",
    }

    # Max file size: 500 MB
    MAX_FILE_SIZE = 500 * 1024 * 1024

    @classmethod
    def validate_file(cls, filename: str, file_size: int) -> tuple[bool, str]:
        """Dosya doğrulama"""
        # Uzantı kontrolü
        ext = Path(filename).suffix.lower()
        if ext not in cls.ALLOWED_EXTENSIONS:
            return (
                False,
                f"Dosya türü izin verilmiyor. İzin verilen: {', '.join(cls.ALLOWED_EXTENSIONS)}",
            )

        # Boyut kontrolü
        if file_size > cls.MAX_FILE_SIZE:
            return False, f"Dosya çok büyük. Max: {cls.MAX_FILE_SIZE // (1024*1024)}MB"

        return True, ""

    @classmethod
    def ensure_upload_dir(cls, company_id: int, project_id: int) -> Path:
        """
        Şirket/Proje klasörünü oluştur ve döndür
        Klasör yapısı: uploads/companies/{company_id}/projects/{project_id}
        """
        project_dir = (
            cls.BASE_UPLOAD_DIR
            / "companies"
            / str(company_id)
            / "projects"
            / str(project_id)
        )
        project_dir.mkdir(parents=True, exist_ok=True)
        return project_dir

    @classmethod
    def generate_filename(cls, file_id: int, original_filename: str) -> str:
        """
        Dosya adı oluştur (ID ile başlayan)
        Format: {file_id}_{cleaned_name}.{ext}
        """
        ext = Path(original_filename).suffix.lower()
        name = Path(original_filename).stem
        # Dosya adını temizle
        name = "".join(c if c.isalnum() or c in "-_" else "_" for c in name)
        return f"{file_id}_{name}{ext}"

    @classmethod
    def save_file(
        cls,
        company_id: int,
        project_id: int,
        file_id: int,
        file_content: bytes,
        original_filename: str,
    ) -> str:
        """
        Dosyayı kaydet
        Args:
            company_id: Şirket ID
            project_id: Proje ID
            file_id: Veritabanındaki dosya kaydının ID'si
            file_content: Dosya içeriği
            original_filename: Orijinal dosya adı

        Returns: file_path (tam dosya yolu)
        """
        # Klasörü oluştur
        project_dir = cls.ensure_upload_dir(company_id, project_id)

        # Dosya adı oluştur
        filename = cls.generate_filename(file_id, original_filename)
        file_path = project_dir / filename

        # Dosyayı kaydet
        with open(file_path, "wb") as f:
            f.write(file_content)

        return str(file_path)

    @classmethod
    def delete_file(cls, file_path: str) -> bool:
        """Dosyayı sil"""
        try:
            path = Path(file_path)
            if path.exists():
                path.unlink()
                return True
        except Exception as e:
            print(f"Dosya silme hatası: {e}")

        return False

    @classmethod
    def get_file_type(cls, filename: str) -> str:
        """Dosya türünü belirle"""
        ext = Path(filename).suffix.lower()

        # Görsel dosyaları
        if ext in {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"}:
            return "image"

        # Sıkıştırılmış
        elif ext in {".zip", ".rar", ".7z", ".tar", ".gz"}:
            return "archive"

        # PDF
        elif ext == ".pdf":
            return "pdf"

        # Video
        elif ext in {".mp4", ".avi", ".mov", ".mkv"}:
            return "video"

        # Excel
        elif ext in {".xlsx", ".xls"}:
            return "spreadsheet"

        # PowerPoint
        elif ext in {".ppt", ".pptx"}:
            return "presentation"

        else:
            return "document"

    @classmethod
    def get_file_path(
        cls, company_id: int, project_id: int, file_id: int, original_filename: str
    ) -> Path:
        """
        Dosyanın tam yolunu hesapla (dosyayı kaydetmeden)
        """
        project_dir = (
            cls.BASE_UPLOAD_DIR
            / "companies"
            / str(company_id)
            / "projects"
            / str(project_id)
        )
        filename = cls.generate_filename(file_id, original_filename)
        return project_dir / filename

    @classmethod
    def get_file_media_type(cls, filename: str) -> str:
        """Dosya MIME type'ını döndür"""
        ext = Path(filename).suffix.lower()

        mime_types = {
            ".pdf": "application/pdf",
            ".txt": "text/plain",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".doc": "application/msword",
            ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            ".xls": "application/vnd.ms-excel",
            ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            ".ppt": "application/vnd.ms-powerpoint",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".webp": "image/webp",
            ".mp4": "video/mp4",
            ".avi": "video/x-msvideo",
            ".mov": "video/quicktime",
            ".mkv": "video/x-matroska",
            ".zip": "application/zip",
            ".rar": "application/x-rar-compressed",
            ".7z": "application/x-7z-compressed",
            ".csv": "text/csv",
            ".json": "application/json",
        }

        return mime_types.get(ext, "application/octet-stream")
