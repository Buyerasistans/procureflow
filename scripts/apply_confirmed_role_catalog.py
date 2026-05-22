import argparse
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass

from sqlalchemy import create_engine, text


PLATFORM_ROLES = [
    "Super Admin",
    "Platform Operasyon Admin",
    "Platform Operasyon Yöneticisi",
    "Platform Operasyon Uzmanı",
    "Platform Destek Admin",
    "Platform Destek Yöneticisi",
    "Platform Destek Uzmanı",
    "Platform Finans Admin",
    "Platform Finans Yöneticisi",
    "Platform Finans Uzmanı",
    "Platform Denetçi / Finans İzleyici",
    "Platform Güvenlik Uzmanı",
    "Platform Raporlama Analisti",
]

PARTNER_ROLES = [
    "Partner Ana Yönetici",
    "Partner Yöneticisi",
    "Satın Alma Direktörü",
    "Satın Alma Müdürü",
    "Satın Alma Müdür Yardımcısı",
    "Satın Alma Yöneticisi",
    "Satın Alma Kıdemli Uzmanı",
    "Satın Alma Uzmanı",
    "Teknik Uzman ve Mimar",
    "Özel Stratejik Partner Rolü",
    "Partner Denetçi / Finans İzleyici",
]

SUPPLIER_ROLES = [
    "Tedarikçi Ana Yönetici",
    "Tedarikçi Yöneticisi",
    "Pazarlama Müdürü",
    "Pazarlama Müdür Yardımcısı",
    "Pazarlama Yöneticisi",
    "Kıdemli Pazarlama Uzmanı",
    "Pazarlama Uzmanı",
    "Teknik Uzman ve Mimar",
    "Teklif Uzmanı",
    "Özel Tedarikçi Rolü",
    "Tedarikçi Denetçi / Finans İzleyici",
]

CHANNEL_ROLES = [
    "Kanal Hesap Sahibi",
    "Kanal Ekip Lideri",
    "Kanal Temsilcisi",
    "Kanal Finans Görüntüleyici",
    "Kanal Denetçisi",
]

# Final canonical role catalog (unicode-safe)
PLATFORM_ROLES = [
    "Super Admin",
    "Platform Operasyon Admin",
    "Platform Operasyon Y\u00f6neticisi",
    "Platform Operasyon Uzman\u0131",
    "Platform Destek Admin",
    "Platform Destek Y\u00f6neticisi",
    "Platform Destek Uzman\u0131",
    "Platform Finans Admin",
    "Platform Finans Y\u00f6neticisi",
    "Platform Finans Uzman\u0131",
    "Platform Denet\u00e7i / Finans \u0130zleyici",
    "Platform G\u00fcvenlik Uzman\u0131",
    "Platform Raporlama Analisti",
]

PARTNER_ROLES = [
    "Partner Ana Y\u00f6netici",
    "Partner Y\u00f6neticisi",
    "Sat\u0131n Alma Direkt\u00f6r\u00fc",
    "Sat\u0131n Alma M\u00fcd\u00fcr\u00fc",
    "Sat\u0131n Alma M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131",
    "Sat\u0131n Alma Y\u00f6neticisi",
    "Sat\u0131n Alma K\u0131demli Uzman\u0131",
    "Sat\u0131n Alma Uzman\u0131",
    "Teknik Uzman ve Mimar",
    "\u00d6zel Stratejik Partner Rol\u00fc",
    "Partner Denet\u00e7i / Finans \u0130zleyici",
]

SUPPLIER_ROLES = [
    "Tedarik\u00e7i Ana Y\u00f6netici",
    "Tedarik\u00e7i Y\u00f6neticisi",
    "Pazarlama M\u00fcd\u00fcr\u00fc",
    "Pazarlama M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131",
    "Pazarlama Y\u00f6neticisi",
    "K\u0131demli Pazarlama Uzman\u0131",
    "Pazarlama Uzman\u0131",
    "Teknik Uzman ve Mimar",
    "Teklif Uzman\u0131",
    "\u00d6zel Tedarik\u00e7i Rol\u00fc",
    "Tedarik\u00e7i Denet\u00e7i / Finans \u0130zleyici",
]

CHANNEL_ROLES = [
    "Kanal Hesap Sahibi",
    "Kanal Ekip Lideri",
    "Kanal Temsilcisi",
    "Kanal Finans G\u00f6r\u00fcnt\u00fcleyici",
    "Kanal Denet\u00e7isi",
]

# Canonical Turkish catalog (override any accidental mojibake above)
PLATFORM_ROLES = [
    "Super Admin",
    "Platform Operasyon Admin",
    "Platform Operasyon Yöneticisi",
    "Platform Operasyon Uzmanı",
    "Platform Destek Admin",
    "Platform Destek Yöneticisi",
    "Platform Destek Uzmanı",
    "Platform Finans Admin",
    "Platform Finans Yöneticisi",
    "Platform Finans Uzmanı",
    "Platform Denetçi / Finans İzleyici",
    "Platform Güvenlik Uzmanı",
    "Platform Raporlama Analisti",
]

PARTNER_ROLES = [
    "Partner Ana Yönetici",
    "Partner Yöneticisi",
    "Satın Alma Direktörü",
    "Satın Alma Müdürü",
    "Satın Alma Müdür Yardımcısı",
    "Satın Alma Yöneticisi",
    "Satın Alma Kıdemli Uzmanı",
    "Satın Alma Uzmanı",
    "Teknik Uzman ve Mimar",
    "Özel Stratejik Partner Rolü",
    "Partner Denetçi / Finans İzleyici",
]

SUPPLIER_ROLES = [
    "Tedarikçi Ana Yönetici",
    "Tedarikçi Yöneticisi",
    "Pazarlama Müdürü",
    "Pazarlama Müdür Yardımcısı",
    "Pazarlama Yöneticisi",
    "Kıdemli Pazarlama Uzmanı",
    "Pazarlama Uzmanı",
    "Teknik Uzman ve Mimar",
    "Teklif Uzmanı",
    "Özel Tedarikçi Rolü",
    "Tedarikçi Denetçi / Finans İzleyici",
]

CHANNEL_ROLES = [
    "Kanal Hesap Sahibi",
    "Kanal Ekip Lideri",
    "Kanal Temsilcisi",
    "Kanal Finans Görüntüleyici",
    "Kanal Denetçisi",
]


def normalize_text(value: str) -> str:
    if not value:
        return value
    fixed = value
    for _ in range(2):
        try:
            decoded = fixed.encode("latin1").decode("utf-8")
            if decoded == fixed:
                break
            fixed = decoded
        except Exception:
            break
    fixed = fixed.replace("\ufffd", " ")
    fixed = re.sub(r"\s+", " ", fixed).strip()
    return fixed


def keyify(value: str) -> str:
    base = normalize_text(value or "").lower().strip()
    norm = unicodedata.normalize("NFKD", base)
    ascii_text = "".join(ch for ch in norm if not unicodedata.combining(ch))
    ascii_text = re.sub(r"[^a-z0-9]+", " ", ascii_text).strip()
    return ascii_text


LEGACY_ROLE_HINTS = {
    "super admin": "Super Admin",
    "super_admin": "Super Admin",
    "platform operasyon admin": "Platform Operasyon Admin",
    "platform operasyon yoneticisi": "Platform Operasyon Yöneticisi",
    "platform operasyon uzmani": "Platform Operasyon Uzmanı",
    "platform destek admin": "Platform Destek Admin",
    "platform destek yoneticisi": "Platform Destek Yöneticisi",
    "platform destek uzmani": "Platform Destek Uzmanı",
    "platform finans admin": "Platform Finans Admin",
    "platform finans yoneticisi": "Platform Finans Yöneticisi",
    "platform finans uzmani": "Platform Finans Uzmanı",
    "platform denetci finans izleyici": "Platform Denetçi / Finans İzleyici",
    "platform guvenlik uzmani": "Platform Güvenlik Uzmanı",
    "platform raporlama analisti": "Platform Raporlama Analisti",
    "partner ana yonetici": "Partner Ana Yönetici",
    "partner yoneticisi": "Partner Yöneticisi",
    "satin alma direktoru": "Satın Alma Direktörü",
    "satin alma muduru": "Satın Alma Müdürü",
    "satin alma mudur yardimcisi": "Satın Alma Müdür Yardımcısı",
    "satin alma yoneticisi": "Satın Alma Yöneticisi",
    "satin alma kidemli uzmani": "Satın Alma Kıdemli Uzmanı",
    "satin alma uzmani": "Satın Alma Uzmanı",
    "teknik uzman ve mimar": "Teknik Uzman ve Mimar",
    "ozel stratejik partner rolu": "Özel Stratejik Partner Rolü",
    "partner denetci finans izleyici": "Partner Denetçi / Finans İzleyici",
    "kanal hesap sahibi": "Kanal Hesap Sahibi",
    "kanal ekip lideri": "Kanal Ekip Lideri",
    "kanal temsilcisi": "Kanal Temsilcisi",
    "kanal finans goruntuleyici": "Kanal Finans Görüntüleyici",
    "kanal denetcisi": "Kanal Denetçisi",
    "tedarikci ana yonetici": "Tedarikçi Ana Yönetici",
    "tedarikci yoneticisi": "Tedarikçi Yöneticisi",
    "pazarlama muduru": "Pazarlama Müdürü",
    "pazarlama mudur yardimcisi": "Pazarlama Müdür Yardımcısı",
    "pazarlama yoneticisi": "Pazarlama Yöneticisi",
    "kidemli pazarlama uzmani": "Kıdemli Pazarlama Uzmanı",
    "pazarlama uzmani": "Pazarlama Uzmanı",
    "teklif uzmani": "Teklif Uzmanı",
    "ozel tedarikci rolu": "Özel Tedarikçi Rolü",
    "tedarikci denetci finans izleyici": "Tedarikçi Denetçi / Finans İzleyici",
}


def match_catalog_role(role_name: str, catalog: list[str]) -> str | None:
    k = keyify(role_name)
    for item in catalog:
        if keyify(item) == k:
            return item
    return LEGACY_ROLE_HINTS.get(k)


@dataclass
class CompanyRow:
    id: int
    name: str
    tenant_id: int | None


def infer_scope(scope_counts: Counter, company_name: str) -> str:
    if scope_counts:
        scope, _ = scope_counts.most_common(1)[0]
        if scope in {"platform", "partner", "supplier", "channel"}:
            return scope
    name_k = keyify(company_name)
    if "kanal" in name_k or "workspace" in name_k:
        return "channel"
    if "tedarik" in name_k or "supplier" in name_k:
        return "supplier"
    if "platform" in name_k or "poseydon" in name_k:
        return "platform"
    return "partner"


def catalog_for_scope(scope: str) -> list[str]:
    if scope == "platform":
        return PLATFORM_ROLES
    if scope == "channel":
        return CHANNEL_ROLES
    if scope == "supplier":
        return SUPPLIER_ROLES
    return PARTNER_ROLES


def run(db_url: str, dry_run: bool) -> None:
    engine = create_engine(db_url)
    report: dict[str, int] = defaultdict(int)

    with engine.begin() as conn:
        companies = [
            CompanyRow(*r)
            for r in conn.execute(
                text("select id, name, tenant_id from companies order by id")
            )
        ]

        user_scope_rows = conn.execute(
            text(
                """
                select cr.company_id, coalesce(u.scope_type, ''), count(distinct u.id)
                from company_roles cr
                join users u on u.id = cr.user_id
                where cr.is_active = true and u.is_active = true
                group by cr.company_id, coalesce(u.scope_type, '')
                """
            )
        ).all()

        scope_by_company: dict[int, Counter] = defaultdict(Counter)
        for company_id, scope_type, cnt in user_scope_rows:
            normalized = scope_type.strip() if scope_type else ""
            if normalized == "":
                normalized = "(null)"
            scope_by_company[int(company_id)][normalized] += int(cnt)

        expected_roles_by_tenant_scope: dict[tuple[int, str], list[str]] = {}
        company_scope: dict[int, str] = {}
        for c in companies:
            inferred = infer_scope(scope_by_company.get(c.id, Counter()), c.name)
            company_scope[c.id] = inferred
            tenant_key = c.tenant_id or c.id
            expected_roles_by_tenant_scope[(tenant_key, inferred)] = catalog_for_scope(
                inferred
            )

        role_rows = conn.execute(
            text("select id, name, coalesce(tenant_id, 0) as tenant_key from roles")
        ).all()
        roles_by_tenant: dict[int, list[tuple[int, str]]] = defaultdict(list)
        for role_id, role_name, tenant_key in role_rows:
            roles_by_tenant[int(tenant_key)].append((int(role_id), role_name))

        role_id_by_tenant_and_name: dict[tuple[int, str], int] = {}
        for tenant_key, roles in roles_by_tenant.items():
            for role_id, role_name in roles:
                role_id_by_tenant_and_name[(tenant_key, role_name)] = role_id

        for (tenant_key, _scope), catalog in expected_roles_by_tenant_scope.items():
            for role_name in catalog:
                if (tenant_key, role_name) in role_id_by_tenant_and_name:
                    continue
                if not dry_run:
                    created = conn.execute(
                        text(
                            """
                            insert into roles (name, description, is_active, tenant_id, hierarchy_level, created_at, updated_at)
                            values (:name, :desc, true, :tenant_id, 0, now(), now())
                            returning id
                            """
                        ),
                        {
                            "name": role_name,
                            "desc": f"Otomatik katalog rolü: {role_name}",
                            "tenant_id": None if tenant_key == 0 else tenant_key,
                        },
                    ).scalar_one()
                    role_id_by_tenant_and_name[(tenant_key, role_name)] = int(created)
                report["roles_created"] += 1

        user_rows = conn.execute(
            text(
                """
                select u.id as user_id, u.full_name, u.email, coalesce(u.scope_type, '') as scope_type,
                       cr.id as company_role_id, cr.company_id, cr.role_id,
                       c.name as company_name, coalesce(c.tenant_id, c.id) as tenant_key,
                       r.name as role_name
                from users u
                join company_roles cr on cr.user_id = u.id and cr.is_active = true
                join companies c on c.id = cr.company_id
                left join roles r on r.id = cr.role_id
                where u.is_active = true
                order by u.id
                """
            )
        ).all()

        for row in user_rows:
            user_id = int(row.user_id)
            company_role_id = int(row.company_role_id)
            company_id = int(row.company_id)
            tenant_key = int(row.tenant_key)
            current_scope = (row.scope_type or "").strip()
            current_role_name = row.role_name or ""

            inferred_scope = company_scope.get(company_id, "partner")
            desired_scope = inferred_scope if inferred_scope != "(null)" else "partner"
            if desired_scope not in {"platform", "partner", "supplier", "channel"}:
                desired_scope = "partner"

            catalog = catalog_for_scope(desired_scope)
            mapped_role_name = match_catalog_role(current_role_name, catalog)
            if not mapped_role_name:
                mapped_role_name = catalog[0]
            desired_role_id = role_id_by_tenant_and_name.get(
                (tenant_key, mapped_role_name)
            )
            if desired_role_id is None:
                continue

            fixed_full_name = normalize_text(row.full_name or "")
            fixed_email = (row.email or "").replace(
                "procureflow.local", "buyerasistans.com.tr"
            )

            if not dry_run:
                if current_scope != desired_scope:
                    conn.execute(
                        text("update users set scope_type=:scope where id=:id"),
                        {"scope": desired_scope, "id": user_id},
                    )
                    report["users_scope_updated"] += 1
                if fixed_full_name != (row.full_name or ""):
                    conn.execute(
                        text("update users set full_name=:name where id=:id"),
                        {"name": fixed_full_name, "id": user_id},
                    )
                    report["users_name_fixed"] += 1
                if fixed_email != (row.email or ""):
                    conn.execute(
                        text("update users set email=:email where id=:id"),
                        {"email": fixed_email, "id": user_id},
                    )
                    report["users_email_fixed"] += 1
                if int(row.role_id or 0) != desired_role_id:
                    conn.execute(
                        text("update company_roles set role_id=:role_id where id=:id"),
                        {"role_id": desired_role_id, "id": company_role_id},
                    )
                    report["company_role_reassigned"] += 1

        for table_name in ("roles", "departments"):
            rows = conn.execute(text(f"select id, name from {table_name}")).all()
            for obj_id, obj_name in rows:
                fixed = normalize_text(obj_name or "")
                if fixed != (obj_name or "") and not dry_run:
                    conn.execute(
                        text(f"update {table_name} set name=:name where id=:id"),
                        {"name": fixed, "id": int(obj_id)},
                    )
                    report[f"{table_name}_name_fixed"] += 1

    print(f"[OK] DB: {db_url}")
    for key in sorted(report):
        print(f"  - {key}: {report[key]}")
    if not report:
        print("  - no changes")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Kesinleşen rol kataloğunu veritabanına uygular."
    )
    parser.add_argument(
        "--db-url",
        action="append",
        required=True,
        help="PostgreSQL URL (birden çok kez verilebilir).",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Değişiklik yapmadan raporla.",
    )
    args = parser.parse_args()

    for db_url in args.db_url:
        run(db_url, args.dry_run)


if __name__ == "__main__":
    main()
