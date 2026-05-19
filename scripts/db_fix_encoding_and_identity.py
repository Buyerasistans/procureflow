from __future__ import annotations

from pathlib import Path

import psycopg


def load_db_url() -> str:
    env_path = Path("api/.env")
    for line in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
        if line.startswith("DATABASE_URL="):
            raw = line.split("=", 1)[1].strip().strip('"').strip("'")
            return raw.replace("postgresql+psycopg://", "postgresql://")
    raise RuntimeError("DATABASE_URL not found in api/.env")


ROLE_NAME_FIXES: dict[str, str] = {
    "Platform Operasyon Y?neticisi": "Platform Operasyon Y\u00f6neticisi",
    "Platform Operasyon Uzman?": "Platform Operasyon Uzman\u0131",
    "Platform Destek Y?neticisi": "Platform Destek Y\u00f6neticisi",
    "Platform Destek Uzman?": "Platform Destek Uzman\u0131",
    "Platform Finans Y?neticisi": "Platform Finans Y\u00f6neticisi",
    "Platform Finans Uzman?": "Platform Finans Uzman\u0131",
    "Platform Denet\u00e7i / Finans ?zleyici": "Platform Denet\u00e7i / Finans \u0130zleyici",
    "Platform G?venlik Uzman?": "Platform G\u00fcvenlik Uzman\u0131",
    "Platform Raporlama Analisti?": "Platform Raporlama Analisti",
    "Partner Ana Y?netici": "Partner Ana Y\u00f6netici",
    "Partner Y?neticisi": "Partner Y\u00f6neticisi",
    "Sat?n Alma Direkt?r?": "Sat\u0131n Alma Direkt\u00f6r\u00fc",
    "Sat?n Alma M?d?r?": "Sat\u0131n Alma M\u00fcd\u00fcr\u00fc",
    "Sat?n Alma M?d?r Yard?mc?s?": "Sat\u0131n Alma M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131",
    "Sat?n Alma Y?neticisi": "Sat\u0131n Alma Y\u00f6neticisi",
    "Sat?n Alma K?demli Uzman?": "Sat\u0131n Alma K\u0131demli Uzman\u0131",
    "Sat?n Alma Uzman?": "Sat\u0131n Alma Uzman\u0131",
    "Teknik Uzman ve Mimar?": "Teknik Uzman ve Mimar",
    "?zel Stratejik Partner Rol?": "\u00d6zel Stratejik Partner Rol\u00fc",
    "Partner Denet?i / Finans ?zleyici": "Partner Denet\u00e7i / Finans \u0130zleyici",
    "Tedarik?i Ana Y?netici": "Tedarik\u00e7i Ana Y\u00f6netici",
    "Tedarik?i Y?neticisi": "Tedarik\u00e7i Y\u00f6neticisi",
    "Pazarlama M?d?r?": "Pazarlama M\u00fcd\u00fcr\u00fc",
    "Pazarlama M?d?r Yard?mc?s?": "Pazarlama M\u00fcd\u00fcr Yard\u0131mc\u0131s\u0131",
    "Pazarlama Y?neticisi": "Pazarlama Y\u00f6neticisi",
    "K?demli Pazarlama Uzman?": "K\u0131demli Pazarlama Uzman\u0131",
    "Pazarlama Uzman?": "Pazarlama Uzman\u0131",
    "Teklif Uzman?": "Teklif Uzman\u0131",
    "?zel Tedarik?i Rol?": "\u00d6zel Tedarik\u00e7i Rol\u00fc",
    "Tedarik?i Denet?i / Finans ?zleyici": "Tedarik\u00e7i Denet\u00e7i / Finans \u0130zleyici",
    "Kanal Finans G?r?nt?leyici": "Kanal Finans G\u00f6r\u00fcnt\u00fcleyici",
    "Kanal Denet?isi": "Kanal Denet\u00e7isi",
}


DEPARTMENT_NAME_FIXES: dict[str, str] = {
    "Bilgi G?venli?i": "Bilgi G\u00fcvenli\u011fi",
    "Sat?n Alma Y?netimi": "Sat\u0131n Alma Y\u00f6netimi",
    "Teknik Ofis ve ?artname": "Teknik Ofis ve \u015eartname",
    "Tedarik?i ?li?kileri": "Tedarik\u00e7i \u0130li\u015fkileri",
    "Pazarlama ve Teklif Y?netimi": "Pazarlama ve Teklif Y\u00f6netimi",
    "Teknik ??z?m ve M?hendislik": "Teknik \u00c7\u00f6z\u00fcm ve M\u00fchendislik",
    "Sat?? Operasyon": "Sat\u0131\u015f Operasyon",
    "M??teri Ba?ar? / ?hale Takip": "M\u00fc\u015fteri Ba\u015far\u0131 / \u0130hale Takip",
    "Kanal Sat??": "Kanal Sat\u0131\u015f",
}


TEXT_FIX_MAP = {
    "Ã§": "\u00e7",
    "Ã‡": "\u00c7",
    "Ä±": "\u0131",
    "Ä°": "\u0130",
    "Ã¶": "\u00f6",
    "Ã–": "\u00d6",
    "Ã¼": "\u00fc",
    "Ãœ": "\u00dc",
    "ÅŸ": "\u015f",
    "Åž": "\u015e",
    "ÄŸ": "\u011f",
    "Äž": "\u011e",
}


def apply_text_mapping(
    cur: psycopg.Cursor, table: str, col: str, mapping: dict[str, str]
) -> int:
    total = 0
    for old_value, new_value in mapping.items():
        cur.execute(
            f"update {table} set {col}=%s where {col}=%s",
            (new_value, old_value),
        )
        total += cur.rowcount
    return total


def apply_bulk_mojibake_fixes(cur: psycopg.Cursor, table: str, col: str) -> int:
    total = 0
    for bad, good in TEXT_FIX_MAP.items():
        cur.execute(
            f"update {table} set {col}=replace({col}, %s, %s) where {col} like %s",
            (bad, good, f"%{bad}%"),
        )
        total += cur.rowcount
    return total


def print_summary(cur: psycopg.Cursor) -> None:
    for table, col in [
        ("roles", "name"),
        ("departments", "name"),
        ("users", "full_name"),
    ]:
        cur.execute(
            f"""
            select count(*)
            from {table}
            where {col} like '%?%'
               or {col} like '%Ã%'
               or {col} like '%Ä%'
               or {col} like '%Å%'
               or {col} like '%ï¿½%'
            """
        )
        print(f"{table}.{col}.broken_count:", cur.fetchone()[0])


def main() -> None:
    conn = psycopg.connect(load_db_url())
    try:
        with conn.transaction():
            with conn.cursor() as cur:
                role_updates = apply_text_mapping(cur, "roles", "name", ROLE_NAME_FIXES)
                dept_updates = apply_text_mapping(
                    cur, "departments", "name", DEPARTMENT_NAME_FIXES
                )
                roles_bulk = apply_bulk_mojibake_fixes(cur, "roles", "name")
                depts_bulk = apply_bulk_mojibake_fixes(cur, "departments", "name")
                users_bulk = apply_bulk_mojibake_fixes(cur, "users", "full_name")
                print("role_name_updates:", role_updates)
                print("department_name_updates:", dept_updates)
                print("roles_bulk_updates:", roles_bulk)
                print("departments_bulk_updates:", depts_bulk)
                print("users_bulk_updates:", users_bulk)
                print_summary(cur)
        print("db_fix_encoding_and_identity: committed")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
