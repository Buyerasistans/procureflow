from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(prefix="/public", tags=["public-locale"])

COUNTRY_TO_LOCALE: dict[str, str] = {
    "TR": "tr",
    "US": "en",
    "GB": "en",
    "CA": "en",
    "AU": "en",
    "NZ": "en",
    "IE": "en",
    "DE": "de",
    "AT": "de",
    "CH": "de",
    "FR": "fr",
    "BE": "fr",
    "LU": "fr",
    "ES": "es",
    "MX": "es",
    "AR": "es",
    "CO": "es",
    "CL": "es",
    "PE": "es",
    "IT": "it",
    "PT": "pt",
    "BR": "pt",
    "NL": "nl",
    "PL": "pl",
    "JP": "ja",
    "KR": "ko",
    "CN": "zh",
    "TW": "zh",
    "HK": "zh",
    "MO": "zh",
    "SA": "ar",
    "AE": "ar",
    "QA": "ar",
    "KW": "ar",
    "BH": "ar",
    "OM": "ar",
    "EG": "ar",
    "JO": "ar",
    "MA": "ar",
    "DZ": "ar",
    "TN": "ar",
    "IQ": "ar",
    "RU": "ru",
    "BY": "ru",
    "KZ": "ru",
    "KG": "ru",
}

SUPPORTED_LOCALES = {
    "tr",
    "en",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "nl",
    "pl",
    "ja",
    "ko",
    "zh",
    "ar",
    "ru",
}


def _normalize_country(value: str | None) -> str:
    raw = str(value or "").strip().upper()
    if len(raw) != 2:
        return ""
    return raw


def _extract_country(request: Request) -> str:
    headers = request.headers
    candidates = [
        headers.get("cf-ipcountry"),
        headers.get("x-vercel-ip-country"),
        headers.get("x-country-code"),
        headers.get("x-geo-country"),
    ]
    for value in candidates:
        normalized = _normalize_country(value)
        if normalized:
            return normalized
    return ""


def _extract_accept_language(request: Request) -> str:
    raw = str(request.headers.get("accept-language") or "").strip()
    if not raw:
        return ""
    first = raw.split(",")[0].strip().lower()
    if "-" in first:
        first = first.split("-")[0]
    return first


@router.get("/locale-hint")
def get_public_locale_hint(request: Request):
    country = _extract_country(request)
    by_country = COUNTRY_TO_LOCALE.get(country, "")
    by_header = _extract_accept_language(request)
    suggested = by_country or by_header or "en"
    if suggested not in SUPPORTED_LOCALES:
        suggested = "en"
    return {
        "locale": suggested,
        "country_code": country or None,
        "source": "country"
        if by_country
        else ("accept-language" if by_header else "default"),
    }
