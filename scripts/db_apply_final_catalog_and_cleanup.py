from __future__ import annotations

from collections import defaultdict
from pathlib import Path
import re
import unicodedata

import psycopg


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

EMAIL_FIXES = {
    "webcadisi@gmail.com": "channel.owner.demo@buyerasistans.com.tr",
    "olimposdanismanlik@gmail.com": "partner.owner.demo@buyerasistans.com.tr",
    "serkaneryilmazz@gmail.com": "partner.admin.demo@buyerasistans.com.tr",
    "poseydonteknoloji@gmail.com": "platform.owner.demo@buyerasistans.com.tr",
}

PLATFORM_COMPANY_NAME_HINTS = ("poseydon", "buyer asistans platform")
CHANNEL_COMPANY_NAME_HINTS = ("kanal", "workspace")


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


def tr_key(value: str) -> str:
    base = unicodedata.normalize("NFKD", (value or "").strip().lower())
    base = "".join(ch for ch in base if not unicodedata.combining(ch))
    base = re.sub(r"[^a-z0-9]+", " ", base).strip()
    return base


def detect_company_scope(name: str) -> str:
    k = tr_key(name)
    if any(h in k for h in PLATFORM_COMPANY_NAME_HINTS):
        return "platform"
    if any(h in k for h in CHANNEL_COMPANY_NAME_HINTS):
        return "channel"
    return "partner"


def best_role_for_user(
    scope: str, system_role: str | None, full_name: str | None
) -> str:
    sr = (system_role or "").lower()
    fn = tr_key(full_name or "")

    if scope == "platform":
        if sr == "super_admin":
            return "Super Admin"
        if "support" in sr:
            return "Platform Destek Uzman\u0131"
        if "finance" in sr:
            return "Platform Finans Uzman\u0131"
        return "Platform Operasyon Uzman\u0131"

    if scope == "channel":
        if "owner" in sr or "hesap sahibi" in fn:
            return "Kanal Hesap Sahibi"
        if "lead" in sr or "ekip lideri" in fn:
            return "Kanal Ekip Lideri"
        if "finance" in sr or "finans" in fn:
            return "Kanal Finans G\u00f6r\u00fcnt\u00fcleyici"
        if "audit" in sr or "denet" in fn:
            return "Kanal Denet\u00e7isi"
        return "Kanal Temsilcisi"

    if scope == "supplier":
        if "owner" in sr or "ana yonetici" in fn:
            return "Tedarik\u00e7i Ana Y\u00f6netici"
        if "admin" in sr or "yonetici" in fn:
            return "Tedarik\u00e7i Y\u00f6neticisi"
        if "teklif" in fn:
            return "Teklif Uzman\u0131"
        if "mimar" in fn or "teknik" in fn:
            return "Teknik Uzman ve Mimar"
        return "Pazarlama Uzman\u0131"

    if "owner" in sr or "ana yonetici" in fn:
        return "Partner Ana Y\u00f6netici"
    if "admin" in sr:
        return "Partner Y\u00f6neticisi"
    if "direktor" in fn:
        return "Sat\u0131n Alma Direkt\u00f6r\u00fc"
    if "mudur yardimcisi" in fn:
        return "Sat\u0131n Alma M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131"
    if "mudur" in fn:
        return "Sat\u0131n Alma M\u00fcd\u00fcr\u00fc"
    if "kidemli uzman" in fn:
        return "Sat\u0131n Alma K\u0131demli Uzman\u0131"
    if "teknik" in fn or "mimar" in fn:
        return "Teknik Uzman ve Mimar"
    if "denet" in fn or "finans izleyici" in fn:
        return "Partner Denet\u00e7i / Finans \u0130zleyici"
    if "ozel" in fn:
        return "\u00d6zel Stratejik Partner Rol\u00fc"
    return "Sat\u0131n Alma Uzman\u0131"


def ensure_role_set(
    cur: psycopg.Cursor, tenant_id: int | None, roles: list[str]
) -> dict[str, int]:
    if tenant_id is None:
        cur.execute(
            "select id,name from roles where tenant_id is null and is_active=true order by id"
        )
    else:
        cur.execute(
            "select id,name from roles where tenant_id=%s and is_active=true order by id",
            (tenant_id,),
        )

    existing = cur.fetchall()
    existing_by_key = {tr_key(name): (int(rid), str(name)) for rid, name in existing}
    existing_exact = {(str(name).strip().lower()): int(rid) for rid, name in existing}
    out: dict[str, int] = {}

    for role_name in roles:
        key = tr_key(role_name)
        exact_key = role_name.strip().lower()
        if exact_key in existing_exact:
            out[role_name] = existing_exact[exact_key]
            continue

        if key in existing_by_key:
            rid, current_name = existing_by_key[key]
            if current_name != role_name:
                # If exact target already exists (unique tenant_id+name), prefer it and keep old row as-is.
                if tenant_id is None:
                    cur.execute(
                        """
                        select id from roles
                        where tenant_id is null and lower(name)=lower(%s) and is_active=true
                        order by id limit 1
                        """,
                        (role_name,),
                    )
                else:
                    cur.execute(
                        """
                        select id from roles
                        where tenant_id=%s and lower(name)=lower(%s) and is_active=true
                        order by id limit 1
                        """,
                        (tenant_id, role_name),
                    )
                target = cur.fetchone()
                if target and int(target[0]) != rid:
                    out[role_name] = int(target[0])
                    continue
                cur.execute(
                    "update roles set name=%s, description=%s, updated_at=now() where id=%s",
                    (role_name, role_name, rid),
                )
            out[role_name] = rid
            continue

        cur.execute(
            """
            insert into roles (name, description, is_active, parent_id, hierarchy_level, created_at, updated_at, tenant_id)
            values (%s, %s, true, null, 0, now(), now(), %s)
            returning id
            """,
            (role_name, role_name, tenant_id),
        )
        out[role_name] = int(cur.fetchone()[0])

    return out


def upsert_company_role(
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
        cur.execute(
            """
            update company_roles
            set company_id=%s, role_id=%s, tenant_id=%s, updated_at=now()
            where user_id=%s and is_active=true
            """,
            (company_id, role_id, tenant_id, user_id),
        )
    else:
        cur.execute(
            """
            insert into company_roles (user_id, company_id, role_id, is_active, tenant_id, created_at, updated_at)
            values (%s,%s,%s,true,%s,now(),now())
            """,
            (user_id, company_id, role_id, tenant_id),
        )


def main() -> None:
    db_url = load_db_url()
    stats = defaultdict(int)

    with psycopg.connect(db_url) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                for old_email, new_email in EMAIL_FIXES.items():
                    cur.execute(
                        "select id from users where lower(email)=lower(%s) limit 1",
                        (old_email,),
                    )
                    row = cur.fetchone()
                    if not row:
                        continue
                    uid = int(row[0])
                    cur.execute(
                        "select 1 from users where lower(email)=lower(%s) and id<>%s limit 1",
                        (new_email, uid),
                    )
                    if cur.fetchone():
                        continue
                    cur.execute(
                        "update users set email=%s where id=%s", (new_email, uid)
                    )
                    stats["email_fixed"] += 1

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
                    k = tr_key(str(name))
                    if platform_company_id is None and any(
                        h in k for h in PLATFORM_COMPANY_NAME_HINTS
                    ):
                        platform_company_id = int(cid)
                    if channel_company_id is None and any(
                        h in k for h in CHANNEL_COMPANY_NAME_HINTS
                    ):
                        channel_company_id = int(cid)

                if platform_company_id is None:
                    raise RuntimeError("Platform company not found")
                if channel_company_id is None:
                    raise RuntimeError("Channel workspace company not found")

                platform_tenant_id = company_by_id[platform_company_id][1]
                channel_tenant_id = company_by_id[channel_company_id][1]

                tenant_ids: set[int | None] = {
                    company_by_id[cid][1] for cid in company_by_id
                }
                role_catalog_ids: dict[tuple[str, int | None], dict[str, int]] = {}

                role_catalog_ids[("platform", platform_tenant_id)] = ensure_role_set(
                    cur, platform_tenant_id, PLATFORM_ROLES
                )
                role_catalog_ids[("channel", channel_tenant_id)] = ensure_role_set(
                    cur, channel_tenant_id, CHANNEL_ROLES
                )
                stats["role_sets_ensured"] += 2

                for tid in sorted(x for x in tenant_ids if x is not None):
                    if tid in (platform_tenant_id, channel_tenant_id):
                        continue
                    role_catalog_ids[("partner", tid)] = ensure_role_set(
                        cur, tid, PARTNER_ROLES
                    )
                    role_catalog_ids[("supplier", tid)] = ensure_role_set(
                        cur, tid, SUPPLIER_ROLES
                    )
                    stats["role_sets_ensured"] += 2

                cur.execute(
                    """
                    update users
                    set is_active=false, hidden_from_admin=true
                    where is_active=true
                      and (
                        lower(email) like 'deleted-user-%'
                        or lower(coalesce(full_name,'')) like 'silinen personel%'
                      )
                    """
                )
                stats["deleted_users_deactivated"] += cur.rowcount

                cur.execute(
                    """
                    select u.id, u.full_name, u.email, coalesce(u.scope_type,''), coalesce(u.system_role,''), u.tenant_id,
                           cr.company_id, c.name, c.tenant_id
                    from users u
                    left join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    left join companies c on c.id=cr.company_id
                    where u.is_active=true
                    order by u.id
                    """
                )
                rows = cur.fetchall()

                for (
                    uid,
                    full_name,
                    email,
                    scope,
                    system_role,
                    user_tenant,
                    company_id,
                    company_name,
                    company_tenant,
                ) in rows:
                    scope = str(scope or "").strip().lower()
                    if scope not in ("platform", "partner", "supplier", "channel"):
                        if company_name:
                            scope = detect_company_scope(str(company_name))
                        elif "channel." in str(email or ""):
                            scope = "channel"
                        elif "supplier." in str(email or ""):
                            scope = "supplier"
                        elif any(
                            h in str(email or "")
                            for h in ("portal", "support@", "finance@")
                        ):
                            scope = "platform"
                        else:
                            scope = "partner"
                        cur.execute(
                            "update users set scope_type=%s where id=%s", (scope, uid)
                        )
                        stats["users_scope_fixed"] += 1

                    target_company_id = int(company_id) if company_id else None
                    target_tenant_id = (
                        company_tenant if company_tenant is not None else user_tenant
                    )

                    if scope == "platform":
                        target_company_id = platform_company_id
                        target_tenant_id = platform_tenant_id
                    elif scope == "channel":
                        target_company_id = target_company_id or channel_company_id
                        target_tenant_id = channel_tenant_id
                    elif scope in ("partner", "supplier"):
                        if target_company_id is None and user_tenant is not None:
                            cur.execute(
                                "select id from companies where tenant_id=%s and is_active=true order by is_primary desc, id limit 1",
                                (user_tenant,),
                            )
                            fallback = cur.fetchone()
                            if fallback:
                                target_company_id = int(fallback[0])
                                target_tenant_id = user_tenant
                        if target_company_id is None:
                            target_company_id = 1
                            target_tenant_id = company_by_id[1][1]

                    if target_company_id is None:
                        continue

                    tenant_for_catalog = target_tenant_id
                    if scope == "platform":
                        catalog = role_catalog_ids[("platform", platform_tenant_id)]
                    elif scope == "channel":
                        catalog = role_catalog_ids[("channel", channel_tenant_id)]
                    elif scope == "supplier":
                        if ("supplier", tenant_for_catalog) not in role_catalog_ids:
                            role_catalog_ids[("supplier", tenant_for_catalog)] = (
                                ensure_role_set(cur, tenant_for_catalog, SUPPLIER_ROLES)
                            )
                            stats["role_sets_ensured"] += 1
                        catalog = role_catalog_ids[("supplier", tenant_for_catalog)]
                    else:
                        if ("partner", tenant_for_catalog) not in role_catalog_ids:
                            role_catalog_ids[("partner", tenant_for_catalog)] = (
                                ensure_role_set(cur, tenant_for_catalog, PARTNER_ROLES)
                            )
                            stats["role_sets_ensured"] += 1
                        catalog = role_catalog_ids[("partner", tenant_for_catalog)]

                    chosen_role_name = best_role_for_user(
                        scope, str(system_role or ""), str(full_name or "")
                    )
                    if chosen_role_name not in catalog:
                        chosen_role_name = next(iter(catalog.keys()))
                    role_id = catalog[chosen_role_name]
                    upsert_company_role(
                        cur,
                        int(uid),
                        int(target_company_id),
                        int(role_id),
                        tenant_for_catalog,
                    )
                    stats["company_roles_upserted"] += 1

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
                    select coalesce(scope_type,'<null>'), count(*)
                    from users where is_active=true
                    group by 1 order by 1
                    """
                )
                print("active_users_by_scope:", cur.fetchall())

                cur.execute(
                    """
                    select coalesce(u.scope_type,'<null>'), count(*)
                    from users u
                    left join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    where u.is_active=true and cr.id is null
                    group by 1 order by 1
                    """
                )
                print("active_users_without_company_role:", cur.fetchall())

    print("db_apply_final_catalog_and_cleanup: committed")
    for key in sorted(stats):
        print(f"{key}: {stats[key]}")


if __name__ == "__main__":
    main()
