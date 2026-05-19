from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import re
import unicodedata

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

CANONICAL_ROLE_NAMES = PLATFORM_ROLES + PARTNER_ROLES + SUPPLIER_ROLES + CHANNEL_ROLES

MANUAL_TEXT_FIXES = {
    "DENEME TEDARİLÇİ EKLEMESİ": "DENEME TEDARİKÇİ EKLEMESİ",
    "denmee tedarikçi": "DENEME TEDARİKÇİ",
    "DENEME TEDARİLÇİ STRATEJİ PARTNER EKLEDİ": "DENEME TEDARİKÇİ STRATEJİ PARTNER EKLEDİ",
}


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


def decode_mojibake(value: str) -> str:
    if not value:
        return value
    out = value
    for _ in range(3):
        try:
            candidate = out.encode("latin1").decode("utf-8")
        except Exception:
            break
        if candidate == out:
            break
        out = candidate
    return out


def clean_text(value: str) -> str:
    if not value:
        return value
    out = decode_mojibake(value).replace("�", " ")
    out = re.sub(r"\s+", " ", out).strip()
    return MANUAL_TEXT_FIXES.get(out, out)


def keyify(value: str) -> str:
    norm = unicodedata.normalize("NFKD", clean_text(value or "").lower())
    norm = "".join(ch for ch in norm if not unicodedata.combining(ch))
    norm = re.sub(r"[^a-z0-9]+", " ", norm).strip()
    return norm


def ensure_role_set(
    cur: psycopg.Cursor, tenant_id: int | None, names: list[str]
) -> dict[str, int]:
    if tenant_id is None:
        cur.execute(
            "select id,name from roles where tenant_id is null and is_active=true"
        )
    else:
        cur.execute(
            "select id,name from roles where tenant_id=%s and is_active=true",
            (tenant_id,),
        )
    existing = cur.fetchall()
    by_key = {keyify(name): int(rid) for rid, name in existing}
    out: dict[str, int] = {}

    for name in names:
        k = keyify(name)
        if k in by_key:
            rid = by_key[k]
            cur.execute(
                "update roles set name=%s, description=%s, updated_at=now() where id=%s",
                (name, name, rid),
            )
            out[name] = rid
            continue
        cur.execute(
            """
            insert into roles (name, description, is_active, parent_id, hierarchy_level, created_at, updated_at, tenant_id)
            values (%s,%s,true,null,0,now(),now(),%s)
            returning id
            """,
            (name, name, tenant_id),
        )
        out[name] = int(cur.fetchone()[0])
    return out


def best_role_for_user(
    scope: str, system_role: str | None, full_name: str | None
) -> str:
    sr = (system_role or "").lower()
    fn = keyify(full_name or "")
    if scope == "platform":
        if sr == "super_admin":
            return "Super Admin"
        if "support" in sr or "destek" in fn:
            return "Platform Destek Uzmanı"
        if "finance" in sr or "finans" in fn:
            return "Platform Finans Uzmanı"
        if "guvenlik" in fn or "güvenlik" in (full_name or "").lower():
            return "Platform Güvenlik Uzmanı"
        return "Platform Operasyon Uzmanı"
    if scope == "channel":
        if "hesap sahibi" in fn or "owner" in sr:
            return "Kanal Hesap Sahibi"
        if "ekip lideri" in fn or "lead" in sr:
            return "Kanal Ekip Lideri"
        if "finans" in fn:
            return "Kanal Finans Görüntüleyici"
        if "denet" in fn or "audit" in sr:
            return "Kanal Denetçisi"
        return "Kanal Temsilcisi"
    if scope == "supplier":
        if "ana yonetici" in fn or "owner" in sr:
            return "Tedarikçi Ana Yönetici"
        if "yonetici" in fn or "admin" in sr:
            return "Tedarikçi Yöneticisi"
        if "teklif" in fn:
            return "Teklif Uzmanı"
        if "teknik" in fn or "mimar" in fn:
            return "Teknik Uzman ve Mimar"
        if "kidemli" in fn:
            return "Kıdemli Pazarlama Uzmanı"
        return "Pazarlama Uzmanı"
    if "ana yonetici" in fn or "owner" in sr:
        return "Partner Ana Yönetici"
    if "admin" in sr or "yonetici" in fn:
        return "Partner Yöneticisi"
    if "direktor" in fn:
        return "Satın Alma Direktörü"
    if "mudur yardimcisi" in fn:
        return "Satın Alma Müdür Yardımcısı"
    if "mudur" in fn:
        return "Satın Alma Müdürü"
    if "kidemli uzman" in fn:
        return "Satın Alma Kıdemli Uzmanı"
    if "teknik" in fn or "mimar" in fn:
        return "Teknik Uzman ve Mimar"
    return "Satın Alma Uzmanı"


def detect_scope(email: str, company_name: str, system_role: str) -> str:
    e = (email or "").lower()
    c = keyify(company_name or "")
    sr = (system_role or "").lower()
    if sr == "super_admin" or "platform" in c or "poseydon" in c:
        return "platform"
    if "channel." in e or "kanal" in c or "workspace" in c:
        return "channel"
    if "supplier." in e or "tedarik" in c or "supplier" in c:
        return "supplier"
    return "partner"


def upsert_single_company_role(
    cur: psycopg.Cursor,
    user_id: int,
    company_id: int,
    role_id: int,
    tenant_id: int | None,
) -> None:
    cur.execute(
        "select id from company_roles where user_id=%s and is_active=true order by id",
        (user_id,),
    )
    rows = cur.fetchall()
    if rows:
        keep_id = int(rows[0][0])
        cur.execute(
            """
            update company_roles
            set company_id=%s, role_id=%s, tenant_id=%s, updated_at=now()
            where id=%s
            """,
            (company_id, role_id, tenant_id, keep_id),
        )
        if len(rows) > 1:
            ids = [int(r[0]) for r in rows[1:]]
            cur.execute(
                "update company_roles set is_active=false, updated_at=now() where id = any(%s)",
                (ids,),
            )
        return
    cur.execute(
        """
        insert into company_roles (user_id, company_id, role_id, is_active, tenant_id, created_at, updated_at)
        values (%s,%s,%s,true,%s,now(),now())
        """,
        (user_id, company_id, role_id, tenant_id),
    )


def main() -> None:
    db_url = load_db_url()
    stats: dict[str, int] = defaultdict(int)
    canonical_role_keys = {keyify(n) for n in CANONICAL_ROLE_NAMES}

    with psycopg.connect(db_url) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                # Clean text columns
                for table, column in [
                    ("users", "full_name"),
                    ("roles", "name"),
                    ("departments", "name"),
                    ("companies", "name"),
                ]:
                    cur.execute(
                        f"select id,{column} from {table} where {column} is not null"
                    )
                    for row_id, raw_val in cur.fetchall():
                        fixed = clean_text(str(raw_val))
                        if fixed != raw_val and fixed:
                            if table == "users":
                                cur.execute(
                                    f"update {table} set {column}=%s where id=%s",
                                    (fixed, int(row_id)),
                                )
                            else:
                                cur.execute(
                                    f"update {table} set {column}=%s, updated_at=now() where id=%s",
                                    (fixed, int(row_id)),
                                )
                            stats[f"{table}_{column}_fixed"] += 1

                cur.execute(
                    "select id,name,tenant_id from companies where is_active=true order by id"
                )
                companies = cur.fetchall()
                company_by_id = {
                    int(cid): (str(name), tid) for cid, name, tid in companies
                }

                platform_company_id = None
                channel_company_id = None
                for cid, name, _tid in companies:
                    k = keyify(str(name))
                    if platform_company_id is None and (
                        "poseydon" in k or "buyer asistans platform" in k
                    ):
                        platform_company_id = int(cid)
                    if channel_company_id is None and (
                        "kanal" in k and "workspace" in k
                    ):
                        channel_company_id = int(cid)
                if platform_company_id is None:
                    raise RuntimeError("Platform company not found")
                if channel_company_id is None:
                    raise RuntimeError("Channel workspace company not found")

                platform_tenant_id = company_by_id[platform_company_id][1]
                channel_tenant_id = company_by_id[channel_company_id][1]

                tenant_ids = sorted({tid for _, _, tid in companies if tid is not None})
                catalogs: dict[tuple[str, int | None], dict[str, int]] = {}
                catalogs[("platform", platform_tenant_id)] = ensure_role_set(
                    cur, platform_tenant_id, PLATFORM_ROLES
                )
                catalogs[("channel", channel_tenant_id)] = ensure_role_set(
                    cur, channel_tenant_id, CHANNEL_ROLES
                )
                for tid in tenant_ids:
                    if tid in (platform_tenant_id, channel_tenant_id):
                        continue
                    catalogs[("partner", tid)] = ensure_role_set(
                        cur, tid, PARTNER_ROLES
                    )
                    catalogs[("supplier", tid)] = ensure_role_set(
                        cur, tid, SUPPLIER_ROLES
                    )
                stats["role_sets_ensured"] = len(catalogs)

                cur.execute(
                    """
                    select u.id, u.email, coalesce(u.full_name,''), coalesce(u.scope_type,''), coalesce(u.system_role,''),
                           u.tenant_id, cr.company_id, c.name, c.tenant_id
                    from users u
                    left join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    left join companies c on c.id=cr.company_id
                    where u.is_active=true
                    order by u.id
                    """
                )
                rows = cur.fetchall()
                supplier_company_ids = {
                    int(cid)
                    for cid, (name, _tid) in company_by_id.items()
                    if "tedarik" in keyify(name) or "supplier" in keyify(name)
                }
                if not supplier_company_ids:
                    supplier_company_ids = {platform_company_id}
                supplier_fallback_company_id = min(supplier_company_ids)

                for (
                    uid,
                    email,
                    full_name,
                    scope_type,
                    system_role,
                    user_tenant,
                    company_id,
                    company_name,
                    company_tenant,
                ) in rows:
                    scope = detect_scope(
                        str(email or ""),
                        str(company_name or ""),
                        str(system_role or ""),
                    )
                    if scope != (scope_type or ""):
                        cur.execute(
                            "update users set scope_type=%s where id=%s",
                            (scope, int(uid)),
                        )
                        stats["users_scope_fixed"] += 1

                    if scope == "platform":
                        target_company_id = platform_company_id
                        target_tenant_id = platform_tenant_id
                    elif scope == "channel":
                        target_company_id = channel_company_id
                        target_tenant_id = channel_tenant_id
                    elif scope == "supplier":
                        current_company_id = int(company_id) if company_id else None
                        if current_company_id in supplier_company_ids:
                            target_company_id = current_company_id
                            target_tenant_id = company_by_id[current_company_id][1]
                        else:
                            target_company_id = supplier_fallback_company_id
                            target_tenant_id = company_by_id[
                                supplier_fallback_company_id
                            ][1]
                    else:
                        current_company_id = int(company_id) if company_id else None
                        if (
                            current_company_id
                            and current_company_id
                            not in (platform_company_id, channel_company_id)
                            and current_company_id not in supplier_company_ids
                        ):
                            target_company_id = current_company_id
                            target_tenant_id = company_by_id[current_company_id][1]
                        else:
                            target_company_id = None
                            target_tenant_id = user_tenant
                            if user_tenant is not None:
                                cur.execute(
                                    """
                                    select id from companies
                                    where tenant_id=%s and is_active=true
                                      and id<>%s and id<>%s
                                      and lower(name) not like '%%tedarik%%'
                                    order by is_primary desc, id
                                    limit 1
                                    """,
                                    (
                                        user_tenant,
                                        platform_company_id,
                                        channel_company_id,
                                    ),
                                )
                                fallback = cur.fetchone()
                                if fallback:
                                    target_company_id = int(fallback[0])
                            if target_company_id is None:
                                target_company_id = platform_company_id
                                target_tenant_id = platform_tenant_id

                    if target_tenant_id is None:
                        target_tenant_id = company_by_id[target_company_id][1]

                    catalog_key = (scope, target_tenant_id)
                    if catalog_key not in catalogs:
                        catalogs[catalog_key] = ensure_role_set(
                            cur,
                            target_tenant_id,
                            PLATFORM_ROLES
                            if scope == "platform"
                            else CHANNEL_ROLES
                            if scope == "channel"
                            else SUPPLIER_ROLES
                            if scope == "supplier"
                            else PARTNER_ROLES,
                        )
                    catalog = catalogs[catalog_key]
                    role_name = best_role_for_user(
                        scope, str(system_role or ""), str(full_name or "")
                    )
                    if role_name not in catalog:
                        role_name = next(iter(catalog.keys()))
                    role_id = catalog[role_name]
                    upsert_single_company_role(
                        cur,
                        int(uid),
                        int(target_company_id),
                        int(role_id),
                        target_tenant_id,
                    )
                    stats["company_roles_normalized"] += 1

                # Deactivate deleted/garbage users
                cur.execute(
                    """
                    update users
                    set is_active=false, hidden_from_admin=true
                    where is_active=true
                      and (
                        lower(email) like 'deleted-user-%'
                        or lower(coalesce(full_name,'')) like 'silinen personel%'
                        or lower(coalesce(full_name,'')) = 'firma atamasi yok'
                      )
                    """
                )
                stats["users_deactivated"] += cur.rowcount

                # Deactivate unused out-of-catalog roles
                cur.execute(
                    """
                    select r.id, r.name
                    from roles r
                    left join company_roles cr on cr.role_id=r.id and cr.is_active=true
                    where r.is_active=true and cr.id is null
                    """
                )
                to_deactivate: list[int] = []
                for rid, rname in cur.fetchall():
                    if keyify(str(rname)) not in canonical_role_keys:
                        to_deactivate.append(int(rid))
                if to_deactivate:
                    cur.execute(
                        "update roles set is_active=false, updated_at=now() where id = any(%s)",
                        (to_deactivate,),
                    )
                stats["unused_roles_deactivated"] += len(to_deactivate)

                # Final safety: one active company_role per user
                cur.execute(
                    """
                    with ranked as (
                      select id, user_id,
                             row_number() over(partition by user_id order by id desc) as rn
                      from company_roles
                      where is_active=true
                    )
                    update company_roles cr
                    set is_active=false, updated_at=now()
                    from ranked r
                    where cr.id=r.id and r.rn>1
                    """
                )
                stats["duplicate_company_roles_deactivated"] += cur.rowcount

                cur.execute(
                    """
                    select scope_type, count(*)
                    from users
                    where is_active=true
                    group by scope_type
                    order by scope_type
                    """
                )
                print("active_users_by_scope:", cur.fetchall())

                cur.execute(
                    """
                    select coalesce(u.scope_type,'<null>'), count(*)
                    from users u
                    left join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    where u.is_active=true and cr.id is null
                    group by 1
                    order by 1
                    """
                )
                print("active_users_without_company_role:", cur.fetchall())

    print("db_normalize_personnel_and_roles: committed")
    for k in sorted(stats):
        print(f"{k}: {stats[k]}")


if __name__ == "__main__":
    main()
