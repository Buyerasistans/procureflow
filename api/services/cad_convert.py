from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path


class CADConversionError(RuntimeError):
    pass


def _iter_default_converter_candidates() -> list[Path]:
    candidates: list[Path] = []

    for root_env in ["ProgramFiles", "ProgramFiles(x86)"]:
        root = os.getenv(root_env, "").strip()
        if not root:
            continue
        oda_root = Path(root) / "ODA"
        if not oda_root.exists():
            continue
        candidates.extend(oda_root.glob("ODAFileConverter*/ODAFileConverter.exe"))

    for fixed_path in [
        "/usr/local/bin/ODAFileConverter",
        "/usr/bin/ODAFileConverter",
        "/opt/ODA/ODAFileConverter/ODAFileConverter",
        "/opt/oda-file-converter/ODAFileConverter",
    ]:
        candidates.append(Path(fixed_path))

    for oda_root in [Path("/opt/ODA"), Path("/opt/oda-file-converter")]:
        if not oda_root.exists():
            continue
        candidates.extend(oda_root.glob("ODAFileConverter*/ODAFileConverter"))
        candidates.extend(oda_root.glob("*/ODAFileConverter"))

    unique_candidates = {str(candidate): candidate for candidate in candidates}
    return sorted(unique_candidates.values(), key=lambda item: str(item), reverse=True)


def _resolve_dwg_converter_executable() -> Path:
    """
    DWG -> DXF dönüştürücüsünü çözümleme sırası:
    1) ENV: DWG_TO_DXF_CONVERTER_PATH
    2) ENV: ODA_CONVERTER_PATH (geriye dönük uyumluluk)
    3) PATH: ODAFileConverter
    4) PATH: TeighaFileConverter
    5) Standart Windows/Linux kurulum yolları

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

    for candidate in _iter_default_converter_candidates():
        if candidate.exists() and candidate.is_file():
            return candidate.resolve()

    raise CADConversionError(
        "DWG dönüştürme aracı bulunamadı. "
        "Sunucuda ODA/Teigha kurun ve PATH'e ekleyin veya DWG_TO_DXF_CONVERTER_PATH/ODA_CONVERTER_PATH tanımlayın."
    )


def can_convert_dwg() -> tuple[bool, str]:
    try:
        exe = _resolve_dwg_converter_executable()
        return True, f"DWG dönüştürücü bulundu: {exe}"
    except Exception as e:
        return False, str(e)


def get_dwg_converter_diagnostics() -> dict[str, str | bool | None]:
    for env_key in ["DWG_TO_DXF_CONVERTER_PATH", "ODA_CONVERTER_PATH"]:
        env_path = os.getenv(env_key, "").strip()
        if not env_path:
            continue
        p = Path(env_path).expanduser()
        if p.exists() and p.is_file():
            return {
                "converter_found": True,
                "resolver_source": f"env:{env_key}",
                "executable_name": p.name,
                "reason": None,
            }
        return {
            "converter_found": False,
            "resolver_source": f"env:{env_key}",
            "executable_name": p.name or None,
            "reason": f"{env_key} tanımlı ama dosya bulunamadı",
        }

    for command_name in ["ODAFileConverter", "TeighaFileConverter"]:
        which_path = shutil.which(command_name)
        if which_path:
            return {
                "converter_found": True,
                "resolver_source": f"path:{command_name}",
                "executable_name": Path(which_path).name,
                "reason": None,
            }

    for candidate in _iter_default_converter_candidates():
        if candidate.exists() and candidate.is_file():
            return {
                "converter_found": True,
                "resolver_source": "default_install:ODA",
                "executable_name": candidate.name,
                "reason": None,
            }

    return {
        "converter_found": False,
        "resolver_source": "unavailable",
        "executable_name": None,
        "reason": "DWG dönüştürme aracı bulunamadı",
    }


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
