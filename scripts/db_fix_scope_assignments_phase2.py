from __future__ import annotations

from pathlib import Path
import re
import unicodedata

import psycopg


PARTNER_COMPANY_IDS = {1, 2, 3, 4, 5, 8, 12, 13}
SUPPLIER_COMPANY_IDS = {54, 56, 59, 60, 61, 62, 63, 64, 65}
CHANNEL_COMPANY_IDS = {14}
PLATFORM_COMPANY_IDS = {11}

PARTNER_TENANTS = {1, 14, 17}
SUPPLIER_TENANTS = {54, 56, 59, 60, 61, 62, 63, 64, 65}
CHANNEL_TENANTS = {18, 19}
PLATFORM_TENANTS = {15}

ROLE_CATALOG = {
    "platform": [
        "Super Admin",
        "Platform Operasyon Admin",
        "Platform Operasyon Yoneticisi",
        "Platform Operasyon Uzmani",
        "Platform Destek Admin",
        "Platform Destek Yoneticisi",
        "Platform Destek Uzmani",
        "Platform Finans Admin",
        "Platform Finans Yoneticisi",
        "Platform Finans Uzmani",
        "Platform Denetci / Finans Izleyici",
        "Platform Guvenlik Uzmani",
        "Platform Raporlama Analisti",
    ],
    "partner": [
        "Partner Ana Yonetici",
        "Partner Yoneticisi",
        "Satin Alma Direktoru",
        "Satin Alma Muduru",
        "Satin Alma Mudur Yardimcisi",
        "Satin Alma Yoneticisi",
        "Satin Alma Kidemli Uzmani",
        "Satin Alma Uzmani",
        "Teknik Uzman ve Mimar",
        "Ozel Stratejik Partner Rolu",
        "Partner Denetci / Finans Izleyici",
    ],
    "supplier": [
        "Tedarikci Ana Yonetici",
        "Tedarikci Yoneticisi",
        "Pazarlama Muduru",
        "Pazarlama Mudur Yardimcisi",
        "Pazarlama Yoneticisi",
        "Kidemli Pazarlama Uzmani",
        "Pazarlama Uzmani",
        "Teknik Uzman ve Mimar",
        "Teklif Uzmani",
        "Ozel Tedarikci Rolu",
        "Tedarikci Denetci / Finans Izleyici",
    ],
    "channel": [
        "Kanal Hesap Sahibi",
        "Kanal Ekip Lideri",
        "Kanal Temsilcisi",
        "Kanal Finans Goruntuleyici",
        "Kanal Denetcisi",
    ],
}

DEFAULT_ROLE = {
    "platform": "Platform Operasyon Uzmani",
    "partner": "Satin Alma Uzmani",
    "supplier": "Pazarlama Uzmani",
    "channel": "Kanal Temsilcisi",
}

TOKEN_SCOPE_MAP = {
    "supplier": "supplier",
    "tedarik": "supplier",
    "pazarlama": "supplier",
    "teklif": "supplier",
    "partner": "partner",
    "stratejik": "partner",
    "satin alma": "partner",
    "kanal": "channel",
    "is ortagi": "channel",
    "channel": "channel",
    "platform": "platform",
    "super admin": "platform",
}

TEXT_FIXES = {
    "?zel": "Ozel",
    "Tedarik?i": "Tedarikci",
    "Y?netici": "Yonetici",
    "M?d?r": "Mudur",
    "K?demli": "Kidemli",
    "G?venlik": "Guvenlik",
    "Denet?i": "Denetci",
    "Izleyici": "Izleyici",
    "I?": "Is",
    "Sat?n": "Satin",
    "Direkt?r": "Direktor",
    "T?rk": "Turk",
    "Ã¶": "o",
    "Ã–": "O",
    "Ã¼": "u",
    "Ãœ": "U",
    "Ä±": "i",
    "Ä°": "I",
    "ÅŸ": "s",
    "Åž": "S",
    "Ã§": "c",
    "Ã‡": "C",
    "ÄŸ": "g",
    "Äž": "G",
}


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found")


def slugify(value: str) -> str:
    norm = unicodedata.normalize("NFKD", value or "")
    norm = "".join(ch for ch in norm if not unicodedata.combining(ch))
    norm = re.sub(r"[^a-zA-Z0-9]+", "-", norm).strip("-").lower()
    return norm or "tenant"


def norm(value: str) -> str:
    v = unicodedata.normalize("NFKD", (value or "").lower())
    v = "".join(ch for ch in v if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", v).strip()


def fix_text(value: str | None) -> str | None:
    if value is None:
        return None
    fixed = value
    for old, new in TEXT_FIXES.items():
        fixed = fixed.replace(old, new)
    return fixed


def detect_scope_from_text(text: str) -> str | None:
    t = norm(text)
    for token, scope in TOKEN_SCOPE_MAP.items():
        if token in t:
            return scope
    return None


def ensure_role(cur: psycopg.Cursor, tenant_id: int | None, role_name: str) -> int:
    if tenant_id is None:
        cur.execute(
            "select id from roles where tenant_id is null and lower(trim(name))=lower(trim(%s)) order by id limit 1",
            (role_name,),
        )
        row = cur.fetchone()
        if row:
            cur.execute(
                "update roles set is_active=true, updated_at=now() where id=%s",
                (int(row[0]),),
            )
            return int(row[0])
        cur.execute(
            """
            insert into roles (name, description, is_active, parent_id, hierarchy_level, created_at, updated_at, tenant_id)
            values (%s, %s, true, null, 0, now(), now(), %s)
            returning id
            """,
            (role_name, role_name, tenant_id),
        )
        return int(cur.fetchone()[0])

    cur.execute(
        "select id from roles where tenant_id=%s and lower(trim(name))=lower(trim(%s)) order by id limit 1",
        (tenant_id, role_name),
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            "update roles set is_active=true, updated_at=now() where id=%s",
            (int(row[0]),),
        )
        return int(row[0])

    cur.execute(
        """
        insert into roles (name, description, is_active, parent_id, hierarchy_level, created_at, updated_at, tenant_id)
        values (%s, %s, true, null, 0, now(), now(), %s)
        on conflict (tenant_id, name)
        do update set is_active=true, updated_at=now()
        returning id
        """,
        (role_name, role_name, tenant_id),
    )
    return int(cur.fetchone()[0])


def ensure_catalog(
    cur: psycopg.Cursor, tenant_id: int | None, scope: str
) -> dict[str, int]:
    out: dict[str, int] = {}
    for role_name in ROLE_CATALOG[scope]:
        out[role_name] = ensure_role(cur, tenant_id, role_name)
    return out


def ensure_tenant(
    cur: psycopg.Cursor, tenant_id: int, legal_name: str, category: str
) -> None:
    cur.execute("select id from tenants where id=%s", (tenant_id,))
    row = cur.fetchone()
    slug = slugify(legal_name)
    if row:
        cur.execute(
            """
            update tenants
            set legal_name=%s,
                brand_name=%s,
                slug=%s,
                category=%s,
                status='active',
                onboarding_status='active',
                is_active=true,
                updated_at=now()
            where id=%s
            """,
            (legal_name, legal_name, slug, category, tenant_id),
        )
        return
    cur.execute(
        """
        insert into tenants (id, slug, legal_name, brand_name, status, onboarding_status, is_active, category, created_at, updated_at)
        values (%s,%s,%s,%s,'active','active',true,%s,now(),now())
        """,
        (tenant_id, slug, legal_name, legal_name, category),
    )


def company_scope(company_id: int, company_name: str, tenant_id: int | None) -> str:
    if company_id in PLATFORM_COMPANY_IDS:
        return "platform"
    if company_id in CHANNEL_COMPANY_IDS:
        return "channel"
    if company_id in PARTNER_COMPANY_IDS:
        return "partner"
    if company_id in SUPPLIER_COMPANY_IDS:
        return "supplier"
    if tenant_id in PLATFORM_TENANTS:
        return "platform"
    if tenant_id in CHANNEL_TENANTS:
        return "channel"
    if tenant_id in PARTNER_TENANTS:
        return "partner"
    if tenant_id in SUPPLIER_TENANTS:
        return "supplier"
    by_text = detect_scope_from_text(company_name)
    return by_text or "supplier"


def best_role(scope: str, full_name: str, role_text: str) -> str:
    t = norm(f"{full_name} {role_text}")
    if scope == "platform":
        if "super admin" in t:
            return "Super Admin"
        if "destek" in t:
            return "Platform Destek Uzmani"
        if "finans" in t:
            return "Platform Finans Uzmani"
        if "rapor" in t:
            return "Platform Raporlama Analisti"
        return DEFAULT_ROLE[scope]
    if scope == "channel":
        if "hesap sahibi" in t:
            return "Kanal Hesap Sahibi"
        if "ekip lider" in t:
            return "Kanal Ekip Lideri"
        if "finans" in t:
            return "Kanal Finans Goruntuleyici"
        if "denet" in t:
            return "Kanal Denetcisi"
        return DEFAULT_ROLE[scope]
    if scope == "supplier":
        if "ana yonetici" in t:
            return "Tedarikci Ana Yonetici"
        if "yonetici" in t:
            return "Tedarikci Yoneticisi"
        if "mudur yardimcisi" in t:
            return "Pazarlama Mudur Yardimcisi"
        if "mudur" in t:
            return "Pazarlama Muduru"
        if "kidemli" in t:
            return "Kidemli Pazarlama Uzmani"
        if "uzman" in t:
            return "Pazarlama Uzmani"
        if "teklif" in t:
            return "Teklif Uzmani"
        if "mimar" in t or "teknik" in t:
            return "Teknik Uzman ve Mimar"
        return DEFAULT_ROLE[scope]
    if "ana yonetici" in t:
        return "Partner Ana Yonetici"
    if "yonetici" in t:
        return "Partner Yoneticisi"
    if "direktor" in t:
        return "Satin Alma Direktoru"
    if "mudur yardimcisi" in t:
        return "Satin Alma Mudur Yardimcisi"
    if "mudur" in t:
        return "Satin Alma Muduru"
    if "kidemli uzman" in t:
        return "Satin Alma Kidemli Uzmani"
    if "uzman" in t:
        return "Satin Alma Uzmani"
    return DEFAULT_ROLE[scope]


def main() -> None:
    with psycopg.connect(load_db_url()) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                for table, col in [
                    ("roles", "name"),
                    ("roles", "description"),
                    ("departments", "name"),
                    ("companies", "name"),
                    ("users", "full_name"),
                ]:
                    cur.execute(
                        f"select id,{col} from {table} where {col} like '%?%' or {col} like '%Ã%' or {col} like '%Ä%' or {col} like '%Å%'"
                    )
                    rows = cur.fetchall()
                    for rid, value in rows:
                        fixed = fix_text(value)
                        if fixed != value:
                            cur.execute(
                                f"update {table} set {col}=%s where id=%s", (fixed, rid)
                            )

                cur.execute(
                    """
                    select c.tenant_id, min(c.name)
                    from companies c
                    left join tenants t on t.id=c.tenant_id
                    where c.tenant_id is not null and t.id is null and c.is_active=true
                    group by c.tenant_id
                    order by c.tenant_id
                    """
                )
                for tenant_id, sample_name in cur.fetchall():
                    tid = int(tenant_id)
                    category = (
                        "Stratejik Partner" if tid in PARTNER_TENANTS else "Tedarikci"
                    )
                    if tid in CHANNEL_TENANTS:
                        category = "Is Ortagi"
                    if tid in PLATFORM_TENANTS:
                        category = "Platform"
                    ensure_tenant(cur, tid, sample_name or f"Tenant {tid}", category)

                for tid in PARTNER_TENANTS:
                    cur.execute(
                        "update tenants set category='Stratejik Partner', status='active', onboarding_status='active', is_active=true where id=%s",
                        (tid,),
                    )
                for tid in SUPPLIER_TENANTS:
                    cur.execute(
                        "update tenants set category='Tedarikci', status='active', onboarding_status='active', is_active=true where id=%s",
                        (tid,),
                    )
                for tid in CHANNEL_TENANTS:
                    cur.execute(
                        "update tenants set category='Is Ortagi', status='active', onboarding_status='active', is_active=true where id=%s",
                        (tid,),
                    )
                for tid in PLATFORM_TENANTS:
                    cur.execute(
                        "update tenants set category='Platform', status='active', onboarding_status='active', is_active=true where id=%s",
                        (tid,),
                    )

                cur.execute("update companies set tenant_id=15 where id=11")

                cur.execute("select id from tenants where is_active=true")
                tenant_ids = [int(x[0]) for x in cur.fetchall()]
                catalogs: dict[tuple[int, str], dict[str, int]] = {}
                for tid in tenant_ids:
                    if tid in PLATFORM_TENANTS:
                        catalogs[(tid, "platform")] = ensure_catalog(
                            cur, tid, "platform"
                        )
                    if tid in CHANNEL_TENANTS:
                        catalogs[(tid, "channel")] = ensure_catalog(cur, tid, "channel")
                    if tid in PARTNER_TENANTS:
                        catalogs[(tid, "partner")] = ensure_catalog(cur, tid, "partner")
                    if tid in SUPPLIER_TENANTS:
                        catalogs[(tid, "supplier")] = ensure_catalog(
                            cur, tid, "supplier"
                        )

                cur.execute(
                    """
                    select u.id, coalesce(u.full_name,''), coalesce(u.system_role,''), coalesce(u.role,''), coalesce(u.role_profile_code,''), u.tenant_id,
                           cr.company_id
                    from users u
                    left join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    where u.is_active=true
                    order by u.id
                    """
                )
                users = cur.fetchall()
                for (
                    uid,
                    full_name,
                    system_role,
                    role,
                    role_profile_code,
                    user_tid,
                    cr_company_id,
                ) in users:
                    target_company_id = int(cr_company_id) if cr_company_id else None
                    if target_company_id is None and user_tid is not None:
                        cur.execute(
                            "select id,name from companies where tenant_id=%s and is_active=true order by is_primary desc,id limit 1",
                            (user_tid,),
                        )
                        row = cur.fetchone()
                        if row:
                            target_company_id = int(row[0])
                    if target_company_id is None:
                        target_company_id = 11

                    cur.execute(
                        "select name,tenant_id from companies where id=%s",
                        (target_company_id,),
                    )
                    c_name, c_tid = cur.fetchone()
                    scope = company_scope(target_company_id, c_name, c_tid)
                    target_tid = int(c_tid) if c_tid is not None else 15

                    if scope == "platform":
                        target_tid = 15
                    elif scope == "channel" and target_tid not in CHANNEL_TENANTS:
                        target_tid = 18
                    elif scope == "partner" and target_tid not in PARTNER_TENANTS:
                        target_tid = 1
                    elif scope == "supplier" and target_tid not in SUPPLIER_TENANTS:
                        target_tid = 64

                    cur.execute(
                        "update users set scope_type=%s, tenant_id=%s where id=%s",
                        (scope, target_tid, uid),
                    )

                    cat_key = (target_tid, scope)
                    if cat_key not in catalogs:
                        catalogs[cat_key] = ensure_catalog(cur, target_tid, scope)

                    chosen = best_role(
                        scope,
                        full_name or "",
                        f"{system_role} {role} {role_profile_code}",
                    )
                    if chosen not in catalogs[cat_key]:
                        chosen = DEFAULT_ROLE[scope]
                    role_id = catalogs[cat_key][chosen]

                    cur.execute(
                        "select id from company_roles where user_id=%s and is_active=true order by id",
                        (uid,),
                    )
                    rows = [int(r[0]) for r in cur.fetchall()]
                    if rows:
                        keep = rows[0]
                        cur.execute(
                            "update company_roles set company_id=%s,tenant_id=%s,role_id=%s,updated_at=now() where id=%s",
                            (target_company_id, target_tid, role_id, keep),
                        )
                        if len(rows) > 1:
                            cur.execute(
                                "update company_roles set is_active=false,updated_at=now() where id=any(%s)",
                                (rows[1:],),
                            )
                    else:
                        cur.execute(
                            """
                            insert into company_roles (user_id,company_id,role_id,tenant_id,is_active,created_at,updated_at)
                            values (%s,%s,%s,%s,true,now(),now())
                            """,
                            (uid, target_company_id, role_id, target_tid),
                        )

                cur.execute("select coalesce(max(id),1) from tenants")
                max_tenant_id = int(cur.fetchone()[0])
                cur.execute(
                    "select setval(pg_get_serial_sequence('tenants','id'), %s, true)",
                    (max_tenant_id,),
                )

                cur.execute(
                    "select scope_type,count(*) from users where is_active=true group by scope_type order by scope_type"
                )
                print("users_by_scope:", cur.fetchall())
                cur.execute(
                    """
                    select c.id,c.name,t.category,count(cr.id)
                    from companies c
                    left join tenants t on t.id=c.tenant_id
                    left join company_roles cr on cr.company_id=c.id and cr.is_active=true
                    where c.is_active=true
                    group by c.id,c.name,t.category
                    order by c.id
                    """
                )
                print("company_scope_preview:")
                for row in cur.fetchall():
                    print(row)

    print("db_fix_scope_assignments_phase2: committed")


if __name__ == "__main__":
    main()
