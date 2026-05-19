import os
from pathlib import Path
from dotenv import set_key, load_dotenv


def update_env_file(env_path: str, updates: dict):
    """
    .env dosyasındaki anahtarları günceller veya ekler.
    """
    env_file = Path(env_path)
    if not env_file.exists():
        raise FileNotFoundError(f".env dosyası bulunamadı: {env_path}")
    load_dotenv(env_path, override=True)
    for key, value in updates.items():
        set_key(env_path, key, str(value))
