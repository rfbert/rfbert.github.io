#!/usr/bin/env bash
# One-command setup for a fresh clone. Idempotent: safe to re-run.
#
#   ./setup.sh          install everything + generate keys + build the Python venv
#
# After this, run the stack with `npm run dev` (five Node services) plus the
# uvicorn line it prints, or run the proof with `cd proof && node run-proof.mjs`.
set -euo pipefail
cd "$(dirname "$0")"

echo "==> root deps (concurrently)"
npm install --no-audit --no-fund --silent

echo "==> five Node services"
npm run install:all

echo "==> proof harness"
( cd proof && npm install --no-audit --no-fund --silent )

echo "==> mock-idp signing keys (idempotent)"
( cd mock-idp && npm run keys )

echo "==> agent-api Python venv"
( cd agent-api
  python3 -m venv .venv
  ./.venv/bin/python -m pip install --quiet --upgrade pip
  ./.venv/bin/python -m pip install --quiet -r requirements.txt )

echo
echo "Setup complete. Next:"
echo "  Terminal 1:  cd agent-api && ./.venv/bin/uvicorn main:app --port 8000"
echo "  Terminal 2:  npm run dev"
echo "  Then open http://localhost:3000"
echo
echo "Or prove it end to end (starts everything itself):"
echo "  cd proof && node run-proof.mjs"
