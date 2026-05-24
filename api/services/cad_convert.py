from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


class CADConversionError(RuntimeError):
    pass


def _resolve_dwg_converter_executable() -> Path:
    """
    DWG -> DXF dönüştürücüsünü çözümleme sırası:
    1) ENV: DWG_TO_DXF_CONVERTER_PATH
    2) ENV: ODA_CONVERTER_PATH (geriye dönük uyumluluk)
    3) PATH: ODAFileConverter
    4) PATH: TeighaFileConverter

    Eğer hostingde ODA/Teigha kurulumu yoksa, buraya başka bir DWG->DXF
    destekli dönüştürücü yolu da verebilirsiniz.
    """
    for env_key in ["DWG_TO_DXF_CONVERTER_PATH", "ODA_CONVERTER_PATH"]:
        env_path = os.getenv(env_key, "").strip()
        if env_path:
            p = Path(env_path).expanduser().resolve()
            if p.exists() and p.is_file():
                return p
            raise CADConversionError(f"{env_key} tanımlı ama dosya bulunamadı: {p}")

    for command_name in ["ODAFileConverter", "TeighaFileConverter"]:
        which_path = shutil.which(command_name)
        if which_path:
            return Path(which_path).resolve()

    raise CADConversionError(
        "DWG dönüştürme aracı bulunamadı. "
        "Sunucuda ODA/Teigha kurun ve PATH'e ekleyin veya DWG_TO_DXF_CONVERTER_PATH/Oda_Converter_PATH tanımlayın."
    )


def can_convert_dwg() -> tuple[bool, str]:
    try:
        exe = _resolve_oda_executable()
        return True, f"DWG donusturucu bulundu: {exe}"
    except Exception as e:
        return False, str(e)


def convert_dwg_to_dxf(
    dwg_file_path: str | Path,
    output_dir: str | Path,
    *,
    output_version: str = "ACAD2013",
    recurse: str = "0",
    audit: str = "1",
) -> Path:
    oda_exe = _resolve_dwg_converter_executable()

    dwg_path = Path(dwg_file_path).resolve()
    if not dwg_path.exists():
        raise CADConversionError(f"DWG dosyası bulunamadı: {dwg_path}")
    if dwg_path.suffix.lower() != ".dwg":
        raise CADConversionError(f"Beklenen uzanti .dwg, gelen: {dwg_path.name}")

    out_dir = Path(output_dir).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    in_dir = dwg_path.parent
    base_name = dwg_path.stem

    cmd = [
        str(oda_exe),
        str(in_dir),
        str(out_dir),
        "ACAD2018",  # input version
        output_version,  # output version
        "DXF",
        recurse,
        audit,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise CADConversionError(
            f"ODA dönüşüm hatası (rc={result.returncode}). "
            f"stderr={result.stderr.strip()} stdout={result.stdout.strip()}"
        )

    expected = out_dir / f"{base_name}.dxf"
    if expected.exists():
        return expected

    candidates = list(out_dir.glob("*.dxf"))
    if not candidates:
        raise CADConversionError("Dönüşüm tamamlandı ancak DXF çıkışı bulunamadı.")
    return candidates[0]
