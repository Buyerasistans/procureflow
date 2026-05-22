from __future__ import annotations

import argparse
import os
import re
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path

import psycopg


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

ALL_CANONICAL = PLATFORM_ROLES + PARTNER_ROLES + SUPPLIER_ROLES + CHANNEL_ROLES


def keyify(value: str) -> str:
    base = (value or "").strip().lower()
    base = unicodedata.normalize("NFKD", base)
    base = "".join(ch for ch in base if not unicodedata.combining(ch))
    base = re.sub(r"[^a-z0-9]+", " ", base).strip()
    return base


CANONICAL_BY_KEY = {keyify(item): item for item in ALL_CANONICAL}


def decode_mojibake(value: str) -> str:
    current = value
    for _ in range(2):
        try:
            raw = current.encode("latin1")
            candidate = raw.decode("utf-8")
        except Exception:
            break
        if candidate == current:
            break
        current = candidate
    return current


def normalize_text(value: str) -> str:
    if value is None:
        return value
    out = value
    if any(tok in out for tok in ("Ã", "Ä", "Å", "�")):
        out = decode_mojibake(out)
    out = out.replace("?", " ")
    out = re.sub(r"\s+", " ", out).strip()
    return out


LEGACY_HINTS = {
    "partner ana yonetici demo": "Partner Ana Yönetici",
    "partner yoneticisi demo": "Partner Yöneticisi",
    "tedarikci ana yonetici demo": "Tedarikçi Ana Yönetici",
    "tedarikci yonetici demo": "Tedarikçi Yöneticisi",
    "kanal ana yonetici demo": "Kanal Hesap Sahibi",
    "kanal denetci demo": "Kanal Denetçisi",
    "kanal ekip lideri demo": "Kanal Ekip Lideri",
    "kanal finans izleyici demo": "Kanal Finans Görüntüleyici",
    "kanal temsilcisi demo": "Kanal Temsilcisi",
    "tenant uyesi": "Satın Alma Uzmanı",
}


def map_legacy_role_name(value: str) -> str | None:
    fixed = normalize_text(value or "")
    k = keyify(fixed)
    if k in CANONICAL_BY_KEY:
        return CANONICAL_BY_KEY[k]
    if k in LEGACY_HINTS:
        return LEGACY_HINTS[k]
    return None


def infer_scope(company_name: str, existing_scope: str) -> str:
    if existing_scope in {"platform", "partner", "supplier", "channel"}:
        return existing_scope
    k = keyify(company_name)
    if "kanal" in k or "workspace" in k:
        return "channel"
    if "tedarikci" in k or "supplier" in k:
        return "supplier"
    if "platform" in k or "poseydon" in k or "buyera asistans platform" in k:
        return "platform"
    return "partner"


def scope_catalog(scope: str) -> list[str]:
    if scope == "platform":
        return PLATFORM_ROLES
    if scope == "supplier":
        return SUPPLIER_ROLES
    if scope == "channel":
        return CHANNEL_ROLES
    return PARTNER_ROLES


@dataclass
class Company:
    id: int
    name: str
    tenant_key: int
    inferred_scope: str


def read_env_db_url() -> str:
    env_path = Path("api/.env")
    if not env_path.exists():
        raise RuntimeError("api/.env not found")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            db = line.split("=", 1)[1].strip().strip('"').strip("'")
            return db.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL missing in api/.env")


def ensure_roles(cur: psycopg.Cursor, tenant_key: int, scope: str) -> dict[str, int]:
    catalog = scope_catalog(scope)
    cur.execute(
        "select id, name from roles where coalesce(tenant_id, 0)=%s order by id",
        (tenant_key,),
    )
    rows = cur.fetchall()
    found: dict[str, int] = {}
    for rid, name in rows:
        mapped = map_legacy_role_name(name)
        if mapped and mapped not in found:
            found[mapped] = int(rid)
    for name in catalog:
        if name in found:
            continue
        cur.execute(
            """
            insert into roles (name, description, is_active, tenant_id, hierarchy_level, created_at, updated_at)
            values (%s, %s, true, %s, 0, now(), now())
            returning id
            """,
            (name, f"Kanonik rol: {name}", None if tenant_key == 0 else tenant_key),
        )
        found[name] = int(cur.fetchone()[0])
    return found


def run(db_url: str, dry_run: bool) -> None:
    stats = defaultdict(int)
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select c.id, c.name, coalesce(c.tenant_id, c.id) as tenant_key,
                       coalesce(mode() within group (order by u.scope_type), '')
                from companies c
                left join company_roles cr on cr.company_id=c.id and cr.is_active=true
                left join users u on u.id=cr.user_id and u.is_active=true
                group by c.id, c.name, coalesce(c.tenant_id, c.id)
                order by c.id
                """
            )
            companies: list[Company] = []
            for cid, cname, tkey, existing_scope in cur.fetchall():
                cname_fixed = normalize_text(cname or "")
                inferred = infer_scope(cname_fixed, (existing_scope or "").strip())
                companies.append(Company(int(cid), cname_fixed, int(tkey), inferred))

            role_map: dict[tuple[int, str], dict[str, int]] = {}
            for company in companies:
                key = (company.tenant_key, company.inferred_scope)
                if key in role_map:
                    continue
                role_map[key] = ensure_roles(
                    cur, company.tenant_key, company.inferred_scope
                )
                stats["role_catalog_groups_processed"] += 1

            cur.execute(
                """
                select u.id, u.full_name, u.email, coalesce(u.scope_type, ''),
                       cr.id as company_role_id, cr.company_id, cr.role_id, r.name as role_name,
                       c.name as company_name, coalesce(c.tenant_id, c.id) as tenant_key
                from users u
                join company_roles cr on cr.user_id=u.id and cr.is_active=true
                join companies c on c.id=cr.company_id
                left join roles r on r.id=cr.role_id
                where u.is_active=true
                order by u.id
                """
            )
            rows = cur.fetchall()
            company_index = {c.id: c for c in companies}
            for (
                uid,
                full_name,
                email,
                scope_type,
                company_role_id,
                company_id,
                role_id,
                role_name,
                _company_name,
                tenant_key,
            ) in rows:
                comp = company_index.get(int(company_id))
                if not comp:
                    continue
                desired_scope = comp.inferred_scope
                catalog_ids = role_map[(comp.tenant_key, desired_scope)]
                canonical = map_legacy_role_name(role_name or "")
                if canonical not in catalog_ids:
                    canonical = scope_catalog(desired_scope)[0]
                desired_role_id = catalog_ids[canonical]

                fixed_name = normalize_text(full_name or "")
                fixed_email = (email or "").replace(
                    "procureflow.local", "buyerasistans.com.tr"
                )
                if role_id != desired_role_id:
                    stats["company_roles_updated"] += 1
                    if not dry_run:
                        cur.execute(
                            "update company_roles set role_id=%s, tenant_id=%s, updated_at=now() where id=%s",
                            (
                                desired_role_id,
                                None if comp.tenant_key == 0 else comp.tenant_key,
                                company_role_id,
                            ),
                        )
                if (scope_type or "") != desired_scope:
                    stats["users_scope_updated"] += 1
                    if not dry_run:
                        cur.execute(
                            "update users set scope_type=%s, updated_at=now() where id=%s",
                            (desired_scope, uid),
                        )
                if fixed_name != (full_name or ""):
                    stats["users_name_fixed"] += 1
                    if not dry_run:
                        cur.execute(
                            "update users set full_name=%s, updated_at=now() where id=%s",
                            (fixed_name, uid),
                        )
                if fixed_email != (email or ""):
                    stats["users_email_fixed"] += 1
                    if not dry_run:
                        cur.execute(
                            "update users set email=%s, updated_at=now() where id=%s",
                            (fixed_email, uid),
                        )

            for table, col in [
                ("roles", "name"),
                ("roles", "description"),
                ("departments", "name"),
                ("departments", "description"),
                ("companies", "name"),
                ("companies", "short_name"),
                ("tenants", "brand_name"),
                ("tenants", "legal_name"),
            ]:
                cur.execute(f"select id, {col} from {table} where {col} is not null")
                fixes = 0
                for rid, value in cur.fetchall():
                    fixed = normalize_text(value or "")
                    mapped = (
                        map_legacy_role_name(fixed)
                        if table == "roles" and col == "name"
                        else None
                    )
                    final = mapped or fixed
                    if final != value:
                        fixes += 1
                        if not dry_run:
                            cur.execute(
                                f"update {table} set {col}=%s where id=%s",
                                (final, rid),
                            )
                stats[f"{table}.{col}_fixed"] += fixes

            cur.execute(
                """
                select company_id, count(*)
                from company_roles
                where is_active=true
                group by company_id
                order by company_id
                """
            )
            assigned = cur.fetchall()
            stats["companies_with_assignments"] = len(assigned)
            stats["company_role_rows_active"] = sum(int(x[1]) for x in assigned)

            if dry_run:
                conn.rollback()
            else:
                conn.commit()

    print(f"[OK] {db_url}")
    print("[SUMMARY]")
    for k in sorted(stats.keys()):
        print(f"- {k}: {stats[k]}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply canonical role catalog and clean mojibake."
    )
    parser.add_argument("--db-url", help="postgresql://...", default=None)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    db_url = args.db_url or os.getenv("DATABASE_URL") or read_env_db_url()
    db_url = db_url.replace("postgresql+psycopg://", "postgresql://")
    run(db_url, args.dry_run)


if __name__ == "__main__":
    main()
