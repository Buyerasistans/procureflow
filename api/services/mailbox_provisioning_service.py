import base64
import json
import secrets
import ssl
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from xml.sax.saxutils import escape

from api.models.email_settings import EmailSettings


COMMON_PUBLIC_MAIL_DOMAINS = {
    "gmail.com",
    "googlemail.com",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "msn.com",
    "yahoo.com",
    "yandex.com",
    "yandex.com.tr",
    "icloud.com",
    "proton.me",
    "protonmail.com",
}


@dataclass
class MailboxProvisioningResult:
    status: str
    message: str
    effective_password: str | None = None


def _split_email(email_address: str) -> tuple[str, str]:
    local_part, _, domain = email_address.partition("@")
    return local_part.strip(), domain.strip().lower()


def _is_custom_domain(domain: str) -> bool:
    return bool(domain) and domain not in COMMON_PUBLIC_MAIL_DOMAINS


def _ssl_context(verify_ssl: bool) -> ssl.SSLContext | None:
    if verify_ssl:
        return None
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context


def _basic_auth_header(username: str, password: str) -> str:
    raw = f"{username}:{password}".encode("utf-8")
    return f"Basic {base64.b64encode(raw).decode('ascii')}"


def _open_request(request: urllib.request.Request, verify_ssl: bool) -> str:
    with urllib.request.urlopen(
        request, context=_ssl_context(verify_ssl), timeout=20
    ) as response:
        return response.read().decode("utf-8", errors="replace")


def _upgrade_to_https(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme.lower() == "https":
        return url
    return urllib.parse.urlunsplit(
        ("https", parsed.netloc, parsed.path, parsed.query, parsed.fragment)
    )


def _friendly_plesk_error(exc: Exception) -> str:
    text = str(exc or "").strip()
    normalized = text.lower()
    if "wrong version number" in normalized:
        return (
            "Plesk API HTTPS bekliyor ancak verilen adres web paneli HTTP kapisina cikiyor. "
            "Panel URL yerine gecerli HTTPS API endpointi kullanin."
        )
    if "timed out" in normalized:
        return "Plesk API endpointine zaman asiminda ulasilamadi."
    return text or "bilinmeyen baglanti hatasi"


def _resolve_plesk_api_endpoint(
    settings: EmailSettings, *, prefer_api_url: bool
) -> str:
    api_url = getattr(settings, "mailbox_provider_api_url", None)
    base_url = (
        api_url
        if prefer_api_url and api_url
        else settings.mailbox_provider_url or api_url
    ) or ""
    cleaned = base_url.strip().rstrip("/")
    if not cleaned:
        return ""
    if "/enterprise/control/agent.php" in cleaned:
        return cleaned
    parsed = urllib.parse.urlsplit(cleaned)
    if "/api/v2" in parsed.path:
        cleaned = urllib.parse.urlunsplit(
            (parsed.scheme, parsed.netloc, "", "", "")
        ).rstrip("/")
    return f"{cleaned}/enterprise/control/agent.php"


def _parse_plesk_connectivity_response(response_text: str) -> MailboxProvisioningResult:
    normalized = response_text.lower()
    if "<status>ok</status>" in normalized or "<protos" in normalized:
        return MailboxProvisioningResult("provisioned", "Plesk baglantisi basarili")
    if "use https instead" in normalized or "security reasons" in normalized:
        return MailboxProvisioningResult(
            "warning",
            "Plesk panele HTTP uzerinden erisildi. Panel HTTPS oneriyor ancak baglanti kurulabildi.",
        )
    return MailboxProvisioningResult(
        "failed", f"Plesk yaniti beklenmedik: {response_text[:220]}"
    )


def _extract_between(text: str, start_tag: str, end_tag: str) -> str:
    start_index = text.find(start_tag)
    if start_index < 0:
        return ""
    start_index += len(start_tag)
    end_index = text.find(end_tag, start_index)
    if end_index < 0:
        return ""
    return text[start_index:end_index].strip()


def _is_likely_strong_password(password: str) -> bool:
    if len(password or "") < 12:
        return False
    has_lower = any(char.islower() for char in password)
    has_upper = any(char.isupper() for char in password)
    has_digit = any(char.isdigit() for char in password)
    has_symbol = any(not char.isalnum() for char in password)
    return has_lower and has_upper and has_digit and has_symbol


def _generate_strong_mailbox_password(local_part: str) -> str:
    prefix = (local_part[:4] or "Mail").capitalize()
    return f"{prefix}!{secrets.token_hex(6)}A9#"


def _resolve_plesk_site_id(settings: EmailSettings, domain: str) -> tuple[str, str]:
    endpoint = _resolve_plesk_api_endpoint(settings, prefer_api_url=True)
    if not endpoint:
        return "", "Plesk API adresi girilmedi"

    packet = f"""
<packet>
  <site>
    <get>
      <filter>
        <name>{escape(domain)}</name>
      </filter>
      <dataset>
        <gen_info/>
      </dataset>
    </get>
  </site>
</packet>
""".strip()

    request = urllib.request.Request(
        endpoint,
        data=packet.encode("utf-8"),
        headers={
            "Content-Type": "text/xml",
            "HTTP_AUTH_LOGIN": settings.mailbox_provider_username,
            "HTTP_AUTH_PASSWD": settings.mailbox_provider_password,
            "KEY": settings.mailbox_provider_api_token or "",
            "Accept": "text/xml",
        },
        method="POST",
    )
    try:
        response_text = _open_request(
            request, bool(settings.mailbox_provider_verify_ssl)
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return "", f"Plesk domain sorgusu hata verdi: {body[:220]}"
    except Exception as exc:  # noqa: BLE001
        return "", _friendly_plesk_error(exc)

    if "<status>error</status>" in response_text.lower():
        errtext = _extract_between(response_text, "<errtext>", "</errtext>")
        return "", errtext or f"Plesk domain sorgusu basarisiz: {response_text[:220]}"

    site_id = _extract_between(response_text, "<id>", "</id>")
    if site_id:
        return site_id, ""
    return "", f"Plesk domain kimligi bulunamadi: {response_text[:220]}"


def _update_existing_plesk_mailbox(
    settings: EmailSettings,
    *,
    endpoint: str,
    site_id: str,
    local_part: str,
    password: str,
) -> MailboxProvisioningResult:
    packet = f"""
<packet>
    <mail>
        <update>
            <set>
                <filter>
                    <site-id>{escape(site_id)}</site-id>
                    <mailname>
                        <name>{escape(local_part)}</name>
                        <password>
                            <value>{escape(password)}</value>
                            <type>plain</type>
                        </password>
                    </mailname>
                </filter>
            </set>
        </update>
    </mail>
</packet>
""".strip()
    request = urllib.request.Request(
        endpoint,
        data=packet.encode("utf-8"),
        headers={
            "Content-Type": "text/xml",
            "HTTP_AUTH_LOGIN": settings.mailbox_provider_username,
            "HTTP_AUTH_PASSWD": settings.mailbox_provider_password,
            "KEY": settings.mailbox_provider_api_token or "",
            "Accept": "text/xml",
        },
        method="POST",
    )
    try:
        response_text = _open_request(
            request, bool(settings.mailbox_provider_verify_ssl)
        )
        if "<status>error</status>" in response_text.lower():
            errtext = _extract_between(response_text, "<errtext>", "</errtext>")
            return MailboxProvisioningResult(
                "failed",
                f"Plesk mailbox zaten vardi ancak parola guncellenemedi: {errtext or response_text[:220]}",
            )
        return MailboxProvisioningResult(
            "provisioned",
            "Hostingte mevcut mailbox bulundu ve parola uygulamadaki degerle esitlendi",
            effective_password=password,
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return MailboxProvisioningResult(
            "failed",
            f"Plesk mailbox zaten vardi ancak parola guncellenemedi: {body[:220]}",
        )
    except Exception as exc:  # noqa: BLE001
        return MailboxProvisioningResult(
            "failed",
            f"Plesk mailbox zaten vardi ancak parola guncellenemedi: {_friendly_plesk_error(exc)}",
        )


def _provision_with_cpanel(
    settings: EmailSettings, local_part: str, domain: str, password: str
) -> MailboxProvisioningResult:
    if not settings.mailbox_provider_url:
        return MailboxProvisioningResult("failed", "cPanel adresi girilmedi")
    if not settings.mailbox_provider_username:
        return MailboxProvisioningResult("failed", "cPanel kullanici adi gerekli")

    base_url = settings.mailbox_provider_url.rstrip("/")
    query = urllib.parse.urlencode(
        {"email": local_part, "domain": domain, "password": password, "quota": 0}
    )
    endpoint = f"{base_url}/execute/Email/add_pop?{query}"
    headers = {"Accept": "application/json"}
    if settings.mailbox_provider_api_token:
        headers["Authorization"] = (
            f"cpanel {settings.mailbox_provider_username}:{settings.mailbox_provider_api_token}"
        )
    elif settings.mailbox_provider_password:
        headers["Authorization"] = _basic_auth_header(
            settings.mailbox_provider_username,
            settings.mailbox_provider_password,
        )
    else:
        return MailboxProvisioningResult(
            "failed", "cPanel parola veya API token gerekli"
        )

    request = urllib.request.Request(endpoint, headers=headers, method="GET")
    try:
        response_text = _open_request(
            request, bool(settings.mailbox_provider_verify_ssl)
        )
        return MailboxProvisioningResult(
            "provisioned", f"cPanel yaniti alindi: {response_text[:220]}"
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return MailboxProvisioningResult("failed", f"cPanel hata verdi: {body[:220]}")
    except Exception as exc:  # noqa: BLE001
        return MailboxProvisioningResult(
            "failed", f"cPanel baglantisi kurulamadi: {exc}"
        )


def _provision_with_plesk(
    settings: EmailSettings, local_part: str, domain: str, password: str
) -> MailboxProvisioningResult:
    if not settings.mailbox_provider_url and not getattr(
        settings, "mailbox_provider_api_url", None
    ):
        return MailboxProvisioningResult(
            "failed", "Plesk panel veya API adresi girilmedi"
        )
    if not settings.mailbox_provider_username or not settings.mailbox_provider_password:
        return MailboxProvisioningResult(
            "failed", "Plesk kullanici adi ve parola gerekli"
        )

    endpoint = _resolve_plesk_api_endpoint(settings, prefer_api_url=True)
    if not endpoint:
        return MailboxProvisioningResult("failed", "Plesk API adresi girilmedi")
    effective_password = password
    password_was_upgraded = False
    if not _is_likely_strong_password(effective_password):
        effective_password = _generate_strong_mailbox_password(local_part)
        password_was_upgraded = True
    site_id, site_error = _resolve_plesk_site_id(settings, domain)
    if not site_id:
        return MailboxProvisioningResult("failed", site_error)
    packet = f"""
<packet>
  <mail>
    <create>
      <filter>
        <site-id>{escape(site_id)}</site-id>
                <mailname>
                    <name>{escape(local_part)}</name>
                    <mailbox>
                        <enabled>true</enabled>
                    </mailbox>
                    <password>
                        <value>{escape(effective_password)}</value>
                        <type>plain</type>
                    </password>
                </mailname>
            </filter>
    </create>
  </mail>
</packet>
""".strip()

    def _make_request(target_endpoint: str) -> urllib.request.Request:
        return urllib.request.Request(
            target_endpoint,
            data=packet.encode("utf-8"),
            headers={
                "Content-Type": "text/xml",
                "HTTP_AUTH_LOGIN": settings.mailbox_provider_username,
                "HTTP_AUTH_PASSWD": settings.mailbox_provider_password,
                "KEY": settings.mailbox_provider_api_token or "",
                "Accept": "text/xml",
            },
            method="POST",
        )

    try:
        response_text = _open_request(
            _make_request(endpoint), bool(settings.mailbox_provider_verify_ssl)
        )
        result = _parse_plesk_connectivity_response(response_text)
        if "<status>error</status>" in response_text.lower():
            errtext = _extract_between(response_text, "<errtext>", "</errtext>")
            if errtext:
                if "already exist" in errtext.lower():
                    return _update_existing_plesk_mailbox(
                        settings,
                        endpoint=endpoint,
                        site_id=site_id,
                        local_part=local_part,
                        password=effective_password,
                    )
                return MailboxProvisioningResult(
                    "failed",
                    f"Plesk hata verdi: {errtext}",
                )
        if (
            result.status in {"provisioned", "warning"}
            or "<status>ok</status>" in response_text.lower()
        ):
            message = "Plesk uzerinde mailbox olusturma istegi gonderildi"
            if password_was_upgraded:
                message = "Plesk strong parola politikasi nedeniyle mailbox sifresi guclendirildi ve hesap olusturuldu"
            return MailboxProvisioningResult(
                "provisioned",
                message,
                effective_password=effective_password,
            )
        return MailboxProvisioningResult(
            "failed",
            f"Plesk yaniti: {response_text[:220]}",
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return MailboxProvisioningResult(
            "failed",
            f"Plesk hata verdi: {body[:220]}",
        )
    except Exception as exc:  # noqa: BLE001
        return MailboxProvisioningResult(
            "failed",
            _friendly_plesk_error(exc),
        )


def _provision_with_custom(
    settings: EmailSettings,
    email_address: str,
    local_part: str,
    domain: str,
    password: str,
) -> MailboxProvisioningResult:
    endpoint = (
        settings.mailbox_provider_custom_endpoint or settings.mailbox_provider_url or ""
    ).strip()
    if not endpoint:
        return MailboxProvisioningResult(
            "failed", "Ozel saglayici endpoint adresi girilmedi"
        )

    payload = json.dumps(
        {
            "action": "create_mailbox",
            "provider": "custom",
            "email": email_address,
            "username": local_part,
            "domain": domain,
            "password": password,
        }
    ).encode("utf-8")
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.mailbox_provider_api_token:
        headers["Authorization"] = f"Bearer {settings.mailbox_provider_api_token}"
    elif settings.mailbox_provider_username and settings.mailbox_provider_password:
        headers["Authorization"] = _basic_auth_header(
            settings.mailbox_provider_username,
            settings.mailbox_provider_password,
        )

    request = urllib.request.Request(
        endpoint, data=payload, headers=headers, method="POST"
    )
    try:
        response_text = _open_request(
            request, bool(settings.mailbox_provider_verify_ssl)
        )
        return MailboxProvisioningResult(
            "provisioned", f"Ozel saglayici yaniti alindi: {response_text[:220]}"
        )
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace")
        return MailboxProvisioningResult(
            "failed", f"Ozel saglayici hata verdi: {body[:220]}"
        )
    except Exception as exc:  # noqa: BLE001
        return MailboxProvisioningResult(
            "failed", f"Ozel saglayiciya ulasilamadi: {exc}"
        )


def test_mailbox_provider_connection(
    settings: EmailSettings | None,
) -> MailboxProvisioningResult:
    if not settings:
        return MailboxProvisioningResult("failed", "Mail profili bulunamadi")

    provider_type = (settings.mailbox_provider_type or "none").strip().lower()
    if provider_type == "none":
        return MailboxProvisioningResult("failed", "Hosting saglayicisi secilmedi")
    if not settings.mailbox_provider_url and not getattr(
        settings, "mailbox_provider_api_url", None
    ):
        return MailboxProvisioningResult("failed", "Panel veya API URL alani bos")

    verify_ssl = bool(settings.mailbox_provider_verify_ssl)

    if provider_type == "plesk":
        if (
            not settings.mailbox_provider_username
            or not settings.mailbox_provider_password
        ):
            return MailboxProvisioningResult(
                "failed", "Plesk kullanici adi ve parola gerekli"
            )
        endpoint = _resolve_plesk_api_endpoint(settings, prefer_api_url=False)
        packet = '<packet version="1.6.9.1"><server><get_protos/></server></packet>'

        def _make_request(target_endpoint: str) -> urllib.request.Request:
            return urllib.request.Request(
                target_endpoint,
                data=packet.encode("utf-8"),
                headers={
                    "Content-Type": "text/xml",
                    "HTTP_AUTH_LOGIN": settings.mailbox_provider_username,
                    "HTTP_AUTH_PASSWD": settings.mailbox_provider_password,
                    "KEY": settings.mailbox_provider_api_token or "",
                    "Accept": "text/xml",
                },
                method="POST",
            )

        try:
            response_text = _open_request(_make_request(endpoint), verify_ssl)
            result = _parse_plesk_connectivity_response(response_text)
            return result
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            return MailboxProvisioningResult(
                "failed", f"Plesk hata verdi: {body[:220]}"
            )
        except Exception as exc:  # noqa: BLE001
            return MailboxProvisioningResult("failed", _friendly_plesk_error(exc))

    if provider_type == "cpanel":
        if not settings.mailbox_provider_username:
            return MailboxProvisioningResult("failed", "cPanel kullanici adi gerekli")
        domain = (settings.mail_domain or "example.com").strip() or "example.com"
        endpoint = f"{settings.mailbox_provider_url.rstrip('/')}/execute/Email/list_pops?domain={urllib.parse.quote(domain)}"
        headers = {"Accept": "application/json"}
        if settings.mailbox_provider_api_token:
            headers["Authorization"] = (
                f"cpanel {settings.mailbox_provider_username}:{settings.mailbox_provider_api_token}"
            )
        elif settings.mailbox_provider_password:
            headers["Authorization"] = _basic_auth_header(
                settings.mailbox_provider_username,
                settings.mailbox_provider_password,
            )
        else:
            return MailboxProvisioningResult(
                "failed", "cPanel parola veya API token gerekli"
            )
        request = urllib.request.Request(endpoint, headers=headers, method="GET")
        try:
            response_text = _open_request(request, verify_ssl)
            if "status" in response_text.lower() or "data" in response_text.lower():
                return MailboxProvisioningResult(
                    "provisioned", "cPanel baglantisi basarili"
                )
            return MailboxProvisioningResult(
                "failed", f"cPanel yaniti beklenmedik: {response_text[:220]}"
            )
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            return MailboxProvisioningResult(
                "failed", f"cPanel hata verdi: {body[:220]}"
            )
        except Exception as exc:  # noqa: BLE001
            return MailboxProvisioningResult(
                "failed", f"cPanel baglantisi kurulamadi: {exc}"
            )

    if provider_type == "custom":
        endpoint = (
            settings.mailbox_provider_custom_endpoint
            or settings.mailbox_provider_url
            or ""
        ).strip()
        if not endpoint:
            return MailboxProvisioningResult(
                "failed", "Ozel saglayici endpoint adresi bos"
            )
        payload = json.dumps({"action": "healthcheck", "provider": "custom"}).encode(
            "utf-8"
        )
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if settings.mailbox_provider_api_token:
            headers["Authorization"] = f"Bearer {settings.mailbox_provider_api_token}"
        elif settings.mailbox_provider_username and settings.mailbox_provider_password:
            headers["Authorization"] = _basic_auth_header(
                settings.mailbox_provider_username,
                settings.mailbox_provider_password,
            )
        request = urllib.request.Request(
            endpoint, data=payload, headers=headers, method="POST"
        )
        try:
            response_text = _open_request(request, verify_ssl)
            return MailboxProvisioningResult(
                "provisioned",
                f"Ozel saglayici baglantisi basarili: {response_text[:220]}",
            )
        except urllib.error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            return MailboxProvisioningResult(
                "failed", f"Ozel saglayici hata verdi: {body[:220]}"
            )
        except Exception as exc:  # noqa: BLE001
            return MailboxProvisioningResult(
                "failed", f"Ozel saglayiciya ulasilamadi: {exc}"
            )

    return MailboxProvisioningResult(
        "failed", f"Desteklenmeyen saglayici tipi: {provider_type}"
    )


def provision_mailbox(
    settings: EmailSettings | None,
    email_address: str,
    password: str,
    *,
    force: bool = False,
) -> MailboxProvisioningResult:
    if not settings:
        return MailboxProvisioningResult("skipped", "Mail profili bulunamadi")
    if not force and not settings.mailbox_provider_auto_create:
        return MailboxProvisioningResult("skipped", "Otomatik mailbox olusturma kapali")

    local_part, domain = _split_email(email_address)
    if not local_part or not domain:
        return MailboxProvisioningResult("failed", "Gecersiz e-posta adresi")
    if not _is_custom_domain(domain):
        return MailboxProvisioningResult(
            "skipped", "Sadece ozel domain mailboxlari otomatik acilir"
        )

    provider_type = (settings.mailbox_provider_type or "none").strip().lower()
    if provider_type == "none":
        return MailboxProvisioningResult("skipped", "Hosting saglayicisi secilmedi")
    if provider_type == "plesk":
        return _provision_with_plesk(settings, local_part, domain, password)
    if provider_type == "cpanel":
        return _provision_with_cpanel(settings, local_part, domain, password)
    if provider_type == "custom":
        return _provision_with_custom(
            settings, email_address, local_part, domain, password
        )
    return MailboxProvisioningResult(
        "failed", f"Desteklenmeyen saglayici tipi: {provider_type}"
    )
