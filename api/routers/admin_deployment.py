from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import asyncio
import json

from api.services.deployment_service import (
    DeploymentService,
    HostingConfig,
    SystemSetupResponse,
    deployment_service,
)

router = APIRouter(
    prefix="/admin/deployment",
    tags=["Admin - Deployment"],
)

logger = logging.getLogger(__name__)


# ============================================================
# Production Guard — Bu router sadece local/dev ortamında çalışır
# ============================================================


def _require_local_env() -> None:
    """
    Deployment endpoint'leri production ortamında tamamen devre dışıdır.
    Sunucudaki .env dosyasında APP_ENV=production olduğunda tüm
    deployment işlemleri 403 döner.
    """
    app_env = os.getenv("APP_ENV", "development").strip().lower()
    if app_env == "production":
        raise HTTPException(
            status_code=403,
            detail=(
                "Deployment paneli production ortaminda devre disidir. "
                "Bu islemler yalnizca local gelistirme ortaminda kullanilabilir."
            ),
        )


# ============================================================
# SSE Yardımcısı — tüm uzun işlemler bunu kullanır
# ============================================================


def _make_sse_stream(svc: DeploymentService, coro):
    """
    Blocking SSH/subprocess iceren coroutine'i thread pool'da calistirir,
    loglari gercek zamanli SSE olarak gonderir.
    """

    async def event_generator():
        yield f"data: {json.dumps({'type': 'start'})}\n\n"

        loop = asyncio.get_event_loop()
        last_log_count = 0

        def run_in_thread():
            import asyncio as _asyncio

            new_loop = _asyncio.new_event_loop()
            _asyncio.set_event_loop(new_loop)
            try:
                return new_loop.run_until_complete(coro)
            finally:
                new_loop.close()

        future = loop.run_in_executor(None, run_in_thread)

        while not future.done():
            await asyncio.sleep(0.3)
            current_logs = svc.deployment_logs
            new_logs = current_logs[last_log_count:]
            for log in new_logs:
                payload = {
                    "type": "log",
                    "timestamp": log.timestamp,
                    "status": log.status,
                    "message": log.message,
                    "step": log.step,
                }
                yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
            last_log_count = len(current_logs)

        current_logs = svc.deployment_logs
        for log in current_logs[last_log_count:]:
            payload = {
                "type": "log",
                "timestamp": log.timestamp,
                "status": log.status,
                "message": log.message,
                "step": log.step,
            }
            yield f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"

        try:
            result = future.result()
            yield f"data: {json.dumps({'type': 'done', 'success': result.success, 'summary': result.summary, 'errors': result.errors}, ensure_ascii=False)}\n\n"
        except Exception:
            logger.exception("Deployment SSE stream failed while finalizing background task result.")
            yield f"data: {json.dumps({'type': 'error', 'message': 'Internal error occurred during deployment operation.'}, ensure_ascii=False)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ============================================================
# .env yardımcıları
# ============================================================


def _env_path() -> Path:
    return Path(__file__).resolve().parents[1] / ".env"


def _read_env_dict() -> dict[str, str]:
    env_file = _env_path()
    result: dict[str, str] = {}
    if not env_file.exists():
        return result
    for line in env_file.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        key, _, val = s.partition("=")
        result[key.strip()] = val.strip()
    return result


def _write_env_key(key: str, value: str) -> None:
    env_file = _env_path()
    lines: list[str] = []
    if env_file.exists():
        lines = env_file.read_text(encoding="utf-8").splitlines(keepends=True)

    updated = False
    new_lines: list[str] = []
    for line in lines:
        s = line.strip()
        if (
            s
            and not s.startswith("#")
            and "=" in s
            and s.split("=", 1)[0].strip() == key
        ):
            new_lines.append(f"{key}={value}\n")
            updated = True
        else:
            new_lines.append(line)

    if not updated:
        new_lines.append(f"{key}={value}\n")

    env_file.write_text("".join(new_lines), encoding="utf-8")


def _strip_quotes(value: str) -> str:
    v = value.strip()
    if len(v) >= 2 and v[0] in ('"', "'") and v[-1] == v[0]:
        v = v[1:-1]
    return v


# ============================================================
# Modeller
# ============================================================


class HostingConfigResponse(BaseModel):
    domain: str
    host_ip: str
    username: str
    password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    remote_path: str
    port: int
    local_db_host: Optional[str] = None
    local_db_port: Optional[int] = None
    local_db_name: Optional[str] = None
    local_db_user: Optional[str] = None
    local_db_password: Optional[str] = None
    remote_db_host: Optional[str] = None
    remote_db_port: Optional[int] = None
    remote_db_name: Optional[str] = None
    remote_db_user: Optional[str] = None
    remote_db_password: Optional[str] = None
    domain_mode_enabled: bool = False


class HostingConfigSaveRequest(BaseModel):
    domain: Optional[str] = None
    host_ip: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    remote_path: Optional[str] = None
    port: Optional[int] = None
    local_db_host: Optional[str] = None
    local_db_port: Optional[int] = None
    local_db_name: Optional[str] = None
    local_db_user: Optional[str] = None
    local_db_password: Optional[str] = None
    remote_db_host: Optional[str] = None
    remote_db_port: Optional[int] = None
    remote_db_name: Optional[str] = None
    remote_db_user: Optional[str] = None
    remote_db_password: Optional[str] = None
    domain_mode_enabled: Optional[bool] = None


# ============================================================
# ENV haritası
# ============================================================

_FIELD_TO_ENV: dict[str, str] = {
    "domain": "SSH_DOMAIN",
    "host_ip": "SSH_HOST",
    "username": "SSH_USER",
    "password": "SSH_PASSWORD",
    "ssh_key_path": "SSH_KEY_PATH",
    "remote_path": "SSH_REMOTE_PATH",
    "port": "SSH_PORT",
    "local_db_host": "LOCAL_DB_HOST",
    "local_db_port": "LOCAL_DB_PORT",
    "local_db_name": "LOCAL_DB_NAME",
    "local_db_user": "LOCAL_DB_USER",
    "local_db_password": "LOCAL_DB_PASSWORD",
    "remote_db_host": "REMOTE_DB_HOST",
    "remote_db_port": "REMOTE_DB_PORT",
    "remote_db_name": "REMOTE_DB_NAME",
    "remote_db_user": "REMOTE_DB_USER",
    "remote_db_password": "REMOTE_DB_PASSWORD",
    "domain_mode_enabled": "DOMAIN_MODE",
}

_ENV_DEFAULTS: dict[str, Any] = {
    "SSH_DOMAIN": "buyerasistans.com.tr",
    "SSH_HOST": "",
    "SSH_USER": "root",
    "SSH_PASSWORD": "",
    "SSH_KEY_PATH": "",
    "SSH_REMOTE_PATH": "/var/www/vhosts/buyerasistans.com.tr/httpdocs",
    "SSH_PORT": "22",
    "LOCAL_DB_HOST": "localhost",
    "LOCAL_DB_PORT": "5432",
    "LOCAL_DB_NAME": "",
    "LOCAL_DB_USER": "",
    "LOCAL_DB_PASSWORD": "",
    "REMOTE_DB_HOST": "localhost",
    "REMOTE_DB_PORT": "5432",
    "REMOTE_DB_NAME": "",
    "REMOTE_DB_USER": "",
    "REMOTE_DB_PASSWORD": "",
    "DOMAIN_MODE": "false",
}


def _build_config_response(env: dict[str, str]) -> HostingConfigResponse:
    def g(k: str) -> str:
        return _strip_quotes(env.get(k, _ENV_DEFAULTS.get(k, "")))

    def gi(k: str, d: int) -> int:
        try:
            return int(_strip_quotes(env.get(k, str(d))))
        except (ValueError, TypeError):
            return d

    return HostingConfigResponse(
        domain=g("SSH_DOMAIN"),
        host_ip=g("SSH_HOST"),
        username=g("SSH_USER"),
        password=g("SSH_PASSWORD") or None,
        ssh_key_path=g("SSH_KEY_PATH") or None,
        remote_path=g("SSH_REMOTE_PATH"),
        port=gi("SSH_PORT", 22),
        local_db_host=g("LOCAL_DB_HOST") or None,
        local_db_port=gi("LOCAL_DB_PORT", 5432),
        local_db_name=g("LOCAL_DB_NAME") or None,
        local_db_user=g("LOCAL_DB_USER") or None,
        local_db_password=g("LOCAL_DB_PASSWORD") or None,
        remote_db_host=g("REMOTE_DB_HOST") or None,
        remote_db_port=gi("REMOTE_DB_PORT", 5432),
        remote_db_name=g("REMOTE_DB_NAME") or None,
        remote_db_user=g("REMOTE_DB_USER") or None,
        remote_db_password=g("REMOTE_DB_PASSWORD") or None,
        domain_mode_enabled=g("DOMAIN_MODE").lower() in {"1", "true", "yes", "on"},
    )


# ============================================================
# Endpoints
# ============================================================

# ── Salt okunur endpoint'ler — production'da da çalışır ──────────────────


@router.get("/hosting-config", response_model=HostingConfigResponse)
async def get_hosting_config() -> HostingConfigResponse:
    """
    Hosting konfigürasyonunu okur.
    Production'da da erişilebilir (salt okunur).
    """
    return _build_config_response(_read_env_dict())


@router.get("/logs")
async def get_deployment_logs() -> dict:
    """Mevcut deployment loglarını döner."""
    return {
        "logs": [log.model_dump() for log in deployment_service.deployment_logs],
        "count": len(deployment_service.deployment_logs),
    }


@router.get("/status")
async def get_deployment_status() -> dict:
    """Deployment durumunu döner."""
    logs = deployment_service.deployment_logs
    last_log = logs[-1] if logs else None
    return {
        "is_running": False,
        "log_count": len(logs),
        "last_message": last_log.message if last_log else "",
        "last_status": last_log.status if last_log else "",
        "last_step": last_log.step if last_log else "",
    }


# ── Yazma/işlem endpoint'leri — SADECE local/dev ortamında çalışır ────────


@router.post("/hosting-config")
async def save_hosting_config(body: HostingConfigSaveRequest) -> dict:
    """Hosting konfigürasyonunu .env dosyasına kaydeder. Sadece local."""
    _require_local_env()
    data = body.model_dump(exclude_none=True)
    for field, value in data.items():
        env_key = _FIELD_TO_ENV.get(field)
        if env_key:
            if field == "domain_mode_enabled":
                _write_env_key(env_key, "true" if bool(value) else "false")
                continue
            _write_env_key(env_key, str(value))
    return {"success": True, "message": "Kaydedildi.", "updated": list(data.keys())}


@router.post("/validate-hosting-config")
async def validate_hosting_config(hosting_config: HostingConfig) -> dict:
    """Hosting konfigürasyonunu doğrular. Sadece local."""
    _require_local_env()
    errors: list[str] = []
    if not (hosting_config.domain or "").strip():
        errors.append("Domain bos olamaz.")
    if not (hosting_config.host_ip or "").strip():
        errors.append("IP Adresi bos olamaz.")
    if not (hosting_config.username or "").strip():
        errors.append("SSH Kullanici adi bos olamaz.")
    has_password = bool((hosting_config.password or "").strip())
    has_key = bool((hosting_config.ssh_key_path or "").strip())
    if not has_password and not has_key:
        errors.append("SSH Sifresi veya SSH Key Yolu girilmelidir.")
    if not (hosting_config.remote_path or "").strip():
        errors.append("Remote Path bos olamaz.")
    if not (1 <= hosting_config.port <= 65535):
        errors.append(f"SSH Port gecersiz: {hosting_config.port}")
    if errors:
        return {"valid": False, "errors": errors, "message": f"{len(errors)} hata var."}
    has_key_bool = bool((hosting_config.ssh_key_path or "").strip())
    return {
        "valid": True,
        "errors": [],
        "message": "Konfigurasyon gecerli.",
        "summary": {
            "domain": hosting_config.domain,
            "host_ip": hosting_config.host_ip,
            "username": hosting_config.username,
            "remote_path": hosting_config.remote_path,
            "port": hosting_config.port,
            "auth_method": "key" if has_key_bool else "password",
        },
    }


@router.post("/test-connection", response_model=SystemSetupResponse)
async def test_connection(hosting_config: HostingConfig) -> SystemSetupResponse:
    """SSH bağlantısını test eder. Sadece local."""
    _require_local_env()
    return await DeploymentService().test_connection(hosting_config)


@router.post("/setup", response_model=SystemSetupResponse)
async def setup_system() -> SystemSetupResponse:
    """Yerel sistem kurulumunu çalıştırır. Sadece local."""
    _require_local_env()
    return await DeploymentService().setup_system()


@router.post("/deploy")
async def deploy(config: HostingConfig):
    """Hostinge deploy eder. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.deploy_to_host(config))


@router.post("/push-local-db")
async def push_local_database_to_hosting(hosting_config: HostingConfig):
    """Yerel DB'yi hostinge gönderir. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.push_local_database_to_hosting(hosting_config))


@router.post("/db-migration")
async def run_remote_db_migration(hosting_config: HostingConfig):
    """Uzak DB migrasyonunu çalıştırır. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.run_remote_db_migration(hosting_config))


@router.post("/clear-remote-files")
async def clear_remote_files(hosting_config: HostingConfig):
    """Hosting dosyalarını temizler. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.clear_remote_files(hosting_config))


@router.post("/reload")
async def reload_remote_site(hosting_config: HostingConfig):
    """Uzak siteyi yeniden başlatır. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.reload_remote_site(hosting_config))


@router.post("/smart-reload")
async def smart_reload(hosting_config: HostingConfig):
    """Akıllı site yenileme. Sadece local."""
    _require_local_env()
    svc = DeploymentService()
    return _make_sse_stream(svc, svc.smart_reload(hosting_config))


@router.post("/refresh-zip", response_model=SystemSetupResponse)
async def refresh_zip() -> SystemSetupResponse:
    """ZIP dosyasını yeniler. Sadece local."""
    _require_local_env()
    return DeploymentService().refresh_zip()
