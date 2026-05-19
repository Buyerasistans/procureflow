from __future__ import annotations

from pathlib import Path
import re
import unicodedata

import psycopg


PASSWORD_HASH = "$pbkdf2-sha256$29000$W6v1vjfG.L8XQihFiHHuXQ$Um/9m.vp2wU1hLqfTRRte4xvMk1Nfd4lJatwP3F5.8Y"
# hash for: Aa1234!!

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

SUPPLIER_EMAIL_TO_ROLE = {
    "supplier.owner.demo@buyerasistans.com.tr": "Tedarikçi Ana Yönetici",
    "supplier.admin.demo@buyerasistans.com.tr": "Tedarikçi Yöneticisi",
    "supplier.sales.demo@buyerasistans.com.tr": "Kıdemli Pazarlama Uzmanı",
    "supplier.pricing.demo@buyerasistans.com.tr": "Teklif Uzmanı",
    "supplier.custom.demo@buyerasistans.com.tr": "Özel Tedarikçi Rolü",
}

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

SUPPLIER_EMAIL_TO_ROLE = {
    "supplier.owner.demo@buyerasistans.com.tr": "Tedarik\u00e7i Ana Y\u00f6netici",
    "supplier.admin.demo@buyerasistans.com.tr": "Tedarik\u00e7i Y\u00f6neticisi",
    "supplier.sales.demo@buyerasistans.com.tr": "K\u0131demli Pazarlama Uzman\u0131",
    "supplier.pricing.demo@buyerasistans.com.tr": "Teklif Uzman\u0131",
    "supplier.custom.demo@buyerasistans.com.tr": "\u00d6zel Tedarik\u00e7i Rol\u00fc",
}

# Canonical Turkish catalog (override accidental mojibake definitions above)
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

SUPPLIER_EMAIL_TO_ROLE = {
    "supplier.owner.demo@buyerasistans.com.tr": "Tedarikçi Ana Yönetici",
    "supplier.admin.demo@buyerasistans.com.tr": "Tedarikçi Yöneticisi",
    "supplier.sales.demo@buyerasistans.com.tr": "Kıdemli Pazarlama Uzmanı",
    "supplier.pricing.demo@buyerasistans.com.tr": "Teklif Uzmanı",
    "supplier.custom.demo@buyerasistans.com.tr": "Özel Tedarikçi Rolü",
}


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


def keyify(value: str) -> str:
    v = tr_clean(value or "")
    v = unicodedata.normalize("NFKD", v.strip().lower())
    v = "".join(ch for ch in v if not unicodedata.combining(ch))
    v = re.sub(r"[^a-z0-9]+", " ", v).strip()
    return v


def decode_mojibake(value: str) -> str:
    if not value:
        return value
    out = value
    for _ in range(2):
        try:
            candidate = out.encode("latin1").decode("utf-8")
        except Exception:
            break
        if candidate == out:
            break
        out = candidate
    return out


def tr_clean(value: str) -> str:
    if not value:
        return value
    out = decode_mojibake(value)
    out = out.replace("�", " ")
    out = re.sub(r"\s+", " ", out).strip()
    return out


def ensure_roles(
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
    by_key = {keyify(n): int(rid) for rid, n in existing}
    out: dict[str, int] = {}
    for name in names:
        k = keyify(name)
        if k in by_key:
            rid = by_key[k]
            cur.execute(
                "update roles set name=%s, updated_at=now() where id=%s", (name, rid)
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


def pick_supplier_role(email: str, full_name: str) -> str:
    e = (email or "").strip().lower()
    if e in SUPPLIER_EMAIL_TO_ROLE:
        return SUPPLIER_EMAIL_TO_ROLE[e]
    k = keyify(full_name or "")
    if "ana yonetici" in k:
        return "Tedarikçi Ana Yönetici"
    if "yonetici" in k:
        return "Tedarikçi Yöneticisi"
    if "teklif" in k or "fiyat" in k:
        return "Teklif Uzmanı"
    if "teknik" in k or "mimar" in k:
        return "Teknik Uzman ve Mimar"
    return "Pazarlama Uzmanı"


def main() -> None:
    db_url = load_db_url()
    stats = {
        "text_fixed": 0,
        "tenant_fixed": 0,
        "supplier_users_upserted": 0,
        "scope_moved": 0,
        "unknown_removed": 0,
    }

    with psycopg.connect(db_url) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                # text cleanup
                for table, col in [
                    ("roles", "name"),
                    ("departments", "name"),
                    ("companies", "name"),
                    ("users", "full_name"),
                ]:
                    cur.execute(f"select id,{col} from {table} where {col} is not null")
                    rows = cur.fetchall()
                    for rid, text in rows:
                        fixed = tr_clean(str(text))
                        if fixed != text:
                            cur.execute(
                                f"update {table} set {col}=%s where id=%s", (fixed, rid)
                            )
                            stats["text_fixed"] += 1

                # company normalization
                cur.execute(
                    "select id,name,tenant_id from companies where is_active=true order by id"
                )
                companies = cur.fetchall()
                by_name = {keyify(n): (int(cid), tid) for cid, n, tid in companies}

                yorpas = by_name.get(keyify("YÖRPAŞ AŞ."))
                if yorpas:
                    yorpas_id = yorpas[0]
                    cur.execute(
                        "update companies set tenant_id=%s where id=%s and coalesce(tenant_id,0)<>%s",
                        (yorpas_id, yorpas_id, yorpas_id),
                    )
                    stats["tenant_fixed"] += cur.rowcount
                    for child in [
                        "KOMAGENE",
                        "PİZZA MAX",
                        "BEREKET DÖNER",
                        "SCHBİTZEL LANDMANN",
                    ]:
                        c = by_name.get(keyify(child))
                        if c:
                            cur.execute(
                                "update companies set tenant_id=%s where id=%s and coalesce(tenant_id,0)<>%s",
                                (yorpas_id, c[0], yorpas_id),
                            )
                            stats["tenant_fixed"] += cur.rowcount

                poseydon = None
                for cid, n, tid in companies:
                    if "poseydon" in keyify(n):
                        poseydon = (int(cid), tid)
                        break
                channel_company = None
                for cid, n, tid in companies:
                    k = keyify(n)
                    if "kanal" in k and "workspace" in k:
                        channel_company = (int(cid), tid)
                        break

                if not poseydon or not channel_company:
                    raise RuntimeError("platform/channel company missing")

                platform_company_id, platform_tenant = poseydon
                channel_company_id, channel_tenant = channel_company

                # role catalogs
                platform_roles = ensure_roles(cur, platform_tenant, PLATFORM_ROLES)
                channel_roles = ensure_roles(cur, channel_tenant, CHANNEL_ROLES)
                partner_cache: dict[int, dict[str, int]] = {}
                supplier_cache: dict[int, dict[str, int]] = {}

                def partner_roles_for_tenant(tid: int | None) -> dict[str, int]:
                    key = int(tid or 0)
                    if key not in partner_cache:
                        partner_cache[key] = ensure_roles(cur, tid, PARTNER_ROLES)
                    return partner_cache[key]

                def supplier_roles_for_tenant(tid: int | None) -> dict[str, int]:
                    key = int(tid or 0)
                    if key not in supplier_cache:
                        supplier_cache[key] = ensure_roles(cur, tid, SUPPLIER_ROLES)
                    return supplier_cache[key]

                # move platform users to platform company
                cur.execute(
                    """
                    update company_roles cr
                    set company_id=%s, role_id=%s, tenant_id=%s, updated_at=now()
                    from users u
                    where u.id=cr.user_id and cr.is_active=true and u.is_active=true
                      and coalesce(u.scope_type,'')='platform'
                      and cr.company_id<>%s
                    """,
                    (
                        platform_company_id,
                        platform_roles["Platform Operasyon Uzmanı"],
                        platform_tenant,
                        platform_company_id,
                    ),
                )
                stats["scope_moved"] += cur.rowcount

                # fix partner user role labels if corrupted
                cur.execute(
                    """
                    select u.id, u.full_name, u.email, c.id, c.tenant_id
                    from users u
                    join company_roles cr on cr.user_id=u.id and cr.is_active=true
                    join companies c on c.id=cr.company_id
                    where u.is_active=true and coalesce(u.scope_type,'')='partner'
                    """
                )
                for uid, full_name, email, cid, tenant_id in cur.fetchall():
                    role_name = "Satın Alma Uzmanı"
                    k = keyify(full_name or "")
                    if "ana yonetici" in k:
                        role_name = "Partner Ana Yönetici"
                    elif "yonetici" in k:
                        role_name = "Partner Yöneticisi"
                    elif "direktor" in k:
                        role_name = "Satın Alma Direktörü"
                    elif "mudur yardimcisi" in k:
                        role_name = "Satın Alma Müdür Yardımcısı"
                    elif "mudur" in k:
                        role_name = "Satın Alma Müdürü"
                    elif "kidemli uzman" in k:
                        role_name = "Satın Alma Kıdemli Uzmanı"
                    elif "teknik" in k or "mimar" in k:
                        role_name = "Teknik Uzman ve Mimar"
                    elif "denet" in k or "finans" in k:
                        role_name = "Partner Denetçi / Finans İzleyici"
                    role_id = partner_roles_for_tenant(tenant_id)[role_name]
                    cur.execute(
                        """
                        update company_roles
                        set role_id=%s, tenant_id=%s, updated_at=now()
                        where user_id=%s and is_active=true
                        """,
                        (role_id, tenant_id, uid),
                    )

                # supplier users -> users + company_roles
                cur.execute(
                    "select id,company_name,city,is_active from suppliers where is_active=true"
                )
                suppliers = cur.fetchall()
                company_by_supplier: dict[int, tuple[int, int | None]] = {}
                cur.execute(
                    "select id,name,tenant_id from companies where is_active=true"
                )
                all_companies = cur.fetchall()
                cmp_by_key = {
                    keyify(n): (int(cid), tid) for cid, n, tid in all_companies
                }

                for sid, sname, _city, _active in suppliers:
                    k = keyify(sname)
                    if k in cmp_by_key:
                        company_by_supplier[int(sid)] = cmp_by_key[k]
                        continue
                    cur.execute(
                        """
                        insert into companies (
                            name, description, is_active, created_at, updated_at,
                            tenant_id, short_name, is_primary, color, hide_location, share_on_whatsapp, mailbox_team_visibility_enabled
                        )
                        values (%s,%s,true,now(),now(),null,%s,true,%s,false,false,false)
                        returning id
                        """,
                        (
                            sname,
                            "Supplier company auto-created",
                            (sname or "")[:40],
                            "#1D4ED8",
                        ),
                    )
                    new_cid = int(cur.fetchone()[0])
                    cur.execute(
                        "update companies set tenant_id=%s where id=%s",
                        (new_cid, new_cid),
                    )
                    company_by_supplier[int(sid)] = (new_cid, new_cid)
                    cmp_by_key[k] = (new_cid, new_cid)

                cur.execute(
                    """
                    select id,supplier_id,name,email,is_active
                    from supplier_users
                    where is_active=true
                    """
                )
                for suid, supplier_id, name, email, _is_active in cur.fetchall():
                    if int(supplier_id) not in company_by_supplier:
                        continue
                    company_id, tenant_id = company_by_supplier[int(supplier_id)]
                    role_name = pick_supplier_role(email or "", name or "")
                    role_id = supplier_roles_for_tenant(tenant_id)[role_name]

                    cur.execute(
                        "select id from users where lower(email)=lower(%s) limit 1",
                        (email,),
                    )
                    row = cur.fetchone()
                    if row:
                        uid = int(row[0])
                        cur.execute(
                            """
                            update users
                            set full_name=%s, scope_type='supplier', is_active=true, hidden_from_admin=false,
                                tenant_id=%s, system_role='employee', role='employee'
                            where id=%s
                            """,
                            (tr_clean(name or role_name), tenant_id, uid),
                        )
                    else:
                        cur.execute(
                            """
                            insert into users (
                                email, hashed_password, full_name, is_active, role,
                                hidden_from_admin, tenant_id, system_role, scope_type, approval_limit
                            )
                            values (%s,%s,%s,true,'employee',false,%s,'employee','supplier',0)
                            returning id
                            """,
                            (
                                email,
                                PASSWORD_HASH,
                                tr_clean(name or role_name),
                                tenant_id,
                            ),
                        )
                        uid = int(cur.fetchone()[0])

                    cur.execute(
                        "select id from company_roles where user_id=%s and is_active=true order by id",
                        (uid,),
                    )
                    crs = cur.fetchall()
                    if crs:
                        cur.execute(
                            """
                            update company_roles
                            set company_id=%s, role_id=%s, tenant_id=%s, updated_at=now()
                            where user_id=%s and is_active=true
                            """,
                            (company_id, role_id, tenant_id, uid),
                        )
                    else:
                        cur.execute(
                            """
                            insert into company_roles (user_id,company_id,role_id,is_active,tenant_id,created_at,updated_at)
                            values (%s,%s,%s,true,%s,now(),now())
                            """,
                            (uid, company_id, role_id, tenant_id),
                        )
                    stats["supplier_users_upserted"] += 1

                # remove firm-assignment-missing garbage
                cur.execute(
                    """
                    update users
                    set is_active=false, hidden_from_admin=true
                    where is_active=true and (
                      lower(coalesce(full_name,'')) like 'firma atamasi yok%%'
                      or lower(coalesce(full_name,'')) like 'firma ataması yok%%'
                    )
                    """
                )
                stats["unknown_removed"] += cur.rowcount

                print("[OK] phase2 repair done")
                for k, v in stats.items():
                    print(f"  - {k}: {v}")


if __name__ == "__main__":
    main()
