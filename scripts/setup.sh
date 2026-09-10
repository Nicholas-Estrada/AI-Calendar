#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"

cd "$project_root/backend"
uv sync --all-extras
if [[ ! -f .env ]]; then
  cp .env.example .env
fi
uv run python scripts/download_whisper_model.py

cd "$project_root/frontend"
npm install

echo "LIAS setup complete. Run ./scripts/dev.sh from the project root."
