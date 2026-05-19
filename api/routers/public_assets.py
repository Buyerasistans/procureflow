from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import FileResponse, PlainTextResponse, Response

router = APIRouter(tags=["public-assets"])

WEB_PUBLIC_DIR = Path(__file__).resolve().parents[2] / "web" / "public"

DOMAIN_CONFIG = {
    "buyerasistans.com.tr": {
        "intent": "corporate",
        "sitemap": "sitemap-main.xml",
    },
    "buyerasistans.com": {
        "intent": "global",
        "sitemap": "sitemap-global.xml",
    },
    "buyerasistans.online": {
        "intent": "campaign",
        "sitemap": "sitemap-campaigns.xml",
    },
    "buyerasistans.info": {
        "intent": "knowledge",
        "sitemap": "sitemap-knowledge.xml",
    },
}

ROBOTS_POLICY = {
    "corporate": {
        "allow": [
            "/",
            "/cozumler",
            "/fiyatlandirma",
            "/stratejik-ortaklik",
            "/onboarding",
        ],
        "disallow": [
            "/api/",
            "/admin",
            "/app",
            "/supplier/",
            "/kampanya",
            "/landing",
            "/lp",
            "/promo",
            "/blog",
            "/rehber",
            "/sozluk",
            "/kaynaklar",
        ],
    },
    "global": {
        "allow": ["/", "/is-ortagi-programi"],
        "disallow": [
            "/api/",
            "/admin",
            "/app",
            "/supplier/",
            "/kampanya",
            "/landing",
            "/lp",
            "/promo",
            "/blog",
            "/rehber",
            "/sozluk",
            "/kaynaklar",
        ],
    },
    "campaign": {
        "allow": [
            "/kampanya",
            "/landing",
            "/lp",
            "/promo",
            "/demo",
            "/tedarikci-ol",
            "/is-ortagi-basvuru",
        ],
        "disallow": [
            "/api/",
            "/admin",
            "/app",
            "/supplier/",
            "/blog",
            "/rehber",
            "/sozluk",
            "/kaynaklar",
        ],
    },
    "knowledge": {
        "allow": ["/blog", "/rehber", "/sozluk", "/kaynaklar"],
        "disallow": [
            "/api/",
            "/admin",
            "/app",
            "/supplier/",
            "/kampanya",
            "/landing",
            "/lp",
            "/promo",
        ],
    },
}

SITEMAP_FILES = {
    "sitemap.xml",
    "sitemap-main.xml",
    "sitemap-global.xml",
    "sitemap-campaigns.xml",
    "sitemap-knowledge.xml",
}


def _normalized_host(request: Request) -> str:
    forwarded_host = request.headers.get("x-forwarded-host")
    raw_host = forwarded_host or request.headers.get("host") or ""
    host = raw_host.split(",", 1)[0].strip().lower()
    if ":" in host:
        host = host.split(":", 1)[0]
    if host.startswith("www."):
        host = host[4:]
    return host


def _domain_asset_config(request: Request) -> dict[str, str]:
    host = _normalized_host(request)
    return DOMAIN_CONFIG.get(
        host,
        {
            "intent": "corporate",
            "sitemap": "sitemap.xml",
        },
    )


def _xml_file_response(file_name: str, request: Request) -> FileResponse:
    asset_path = WEB_PUBLIC_DIR / file_name
    config = _domain_asset_config(request)
    return FileResponse(
        asset_path,
        media_type="application/xml",
        headers={"X-Domain-Intent": config["intent"]},
    )


@router.get("/robots.txt", include_in_schema=False)
def get_public_robots(request: Request):
    host = _normalized_host(request) or "buyerasistans.com.tr"
    config = _domain_asset_config(request)
    sitemap_name = config["sitemap"]
    policy = ROBOTS_POLICY.get(config["intent"], ROBOTS_POLICY["corporate"])
    body = "\n".join(
        [
            "User-agent: *",
            *[f"Allow: {path}" for path in policy["allow"]],
            *[f"Disallow: {path}" for path in policy["disallow"]],
            f"Sitemap: https://{host}/{sitemap_name}",
            "",
        ]
    )
    return PlainTextResponse(
        body,
        headers={"X-Domain-Intent": config["intent"]},
    )


@router.get("/sitemap.xml", include_in_schema=False)
def get_root_sitemap(request: Request):
    config = _domain_asset_config(request)
    return _xml_file_response(config["sitemap"], request)


@router.get("/{file_name}", include_in_schema=False)
def get_named_sitemap(file_name: str, request: Request):
    if file_name not in SITEMAP_FILES:
        return Response(status_code=404)
    return _xml_file_response(file_name, request)
