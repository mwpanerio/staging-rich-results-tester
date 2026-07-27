#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -s "$HOME/.nvm/nvm.sh" ]; then
  # shellcheck disable=SC1091
  . "$HOME/.nvm/nvm.sh"
  if [ -f .nvmrc ]; then
    nvm use >/dev/null
  else
    nvm use 22 >/dev/null || nvm use 20 >/dev/null || true
  fi
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 20 ]; then
  echo "Node.js 20+ is required (current: $(node -v))."
  echo "Run: nvm use 22 && npm start"
  exit 1
fi

exec node server.js
