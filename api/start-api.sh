#!/usr/bin/env bash
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$script_dir"

if [ ! -x ".venv/bin/python" ]; then
  echo ".venv virtual environment not found. Create it with: python3 -m venv .venv"
  exit 1
fi

export PYTHONPATH="$(dirname "$script_dir")"
./.venv/bin/python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
