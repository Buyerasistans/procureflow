#!/usr/bin/env python3
import os
import shutil
from pathlib import Path


def cleanup():
    root = Path(".")

    # Silinecek patterns
    to_delete = [
        "check_*.py",
        "create_*.py",
        "debug_*.py",
        "decode_jwt.py",
        "final_test.py",
        "find_admin.py",
        "fix_*.py",
        "init_db.py",
        "inspect_users_table.py",
        "load_*.py",
        "reset_admin_password.py",
        "seed_*.py",
        "PİZZAMAX_TEKLİF_.csv",
        "PİZZAMAX_TEKLİF_.xlsx",
        "token.txt",
    ]

    # Silinecek directoriler
    to_delete_dirs = [
        "web/node_modules",
        "web/dist",
        "web/.vite",
        "api/__pycache__",
        "api/.pytest_cache",
    ]

    for pattern in to_delete:
        for f in root.glob(pattern):
            if f.is_file():
                print(f"Deleting: {f}")
                f.unlink()

    for d in to_delete_dirs:
        path = root / d
        if path.exists():
            print(f"Deleting: {path}")
            shutil.rmtree(path)

    # Find and delete __pycache__ and .pytest_cache directories everywhere
    for cache_dir in root.rglob("__pycache__"):
        if cache_dir.is_dir():
            print(f"Deleting: {cache_dir}")
            shutil.rmtree(cache_dir)

    for cache_dir in root.rglob(".pytest_cache"):
        if cache_dir.is_dir():
            print(f"Deleting: {cache_dir}")
            shutil.rmtree(cache_dir)

    print("Cleanup complete!")


if __name__ == "__main__":
    cleanup()
