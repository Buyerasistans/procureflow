from __future__ import annotations

from pprint import pprint

from api.db.session import SessionLocal
from api.services.scope_demo_bootstrap import seed_scope_demo_data


def main() -> None:
    db = SessionLocal()
    try:
        result = seed_scope_demo_data(db)
        pprint(result)
    finally:
        db.close()


if __name__ == "__main__":
    main()
