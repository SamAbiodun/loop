#!/usr/bin/env bash
#
# One-shot setup for the loop DSA voice interview app.
# Run after cloning:  bash scripts/setup.sh
#
# Installs dependencies and seeds .env.local.

set -euo pipefail

REQUIRED_NODE_MAJOR=20
REQUIRED_NODE_MINOR=9

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m x\033[0m %s\n' "$1" >&2; exit 1; }

# --- 1. Prerequisites --------------------------------------------------------
command -v node >/dev/null 2>&1 || fail "Node.js is not installed. Install Node >= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR} (brew install node, or https://nodejs.org)."
command -v npm  >/dev/null 2>&1 || fail "npm is not installed (it ships with Node.js)."

NODE_VER="$(node -v | sed 's/^v//')"
NODE_MAJOR="${NODE_VER%%.*}"
NODE_MINOR="$(printf '%s' "$NODE_VER" | cut -d. -f2)"
if [ "$NODE_MAJOR" -lt "$REQUIRED_NODE_MAJOR" ] ||
   { [ "$NODE_MAJOR" -eq "$REQUIRED_NODE_MAJOR" ] && [ "$NODE_MINOR" -lt "$REQUIRED_NODE_MINOR" ]; }; then
  fail "Node $NODE_VER found, but >= ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}.0 is required."
fi
info "Node $NODE_VER OK"

# --- 2. Dependencies ----------------------------------------------------------
info "Installing dependencies"
( cd "$LOOP_DIR" && npm install --no-audit --no-fund --loglevel=error )

# --- 3. Env file -------------------------------------------------------------
if [ -f "$LOOP_DIR/.env.local" ]; then
  info ".env.local already exists — leaving it untouched"
elif [ -f "$LOOP_DIR/.env.local.example" ]; then
  cp "$LOOP_DIR/.env.local.example" "$LOOP_DIR/.env.local"
  warn "Created .env.local from the example — add your OPENAI_API_KEY before running."
else
  printf 'OPENAI_API_KEY=\n\n# Optional shared passcode. Leave unset to run open (fine for localhost);\n# set it in production to gate the paid APIs. See README > Deploying.\n# APP_PASSCODE=\n' > "$LOOP_DIR/.env.local"
  warn "Created an empty .env.local — add your OPENAI_API_KEY before running."
fi

# --- 4. Done -----------------------------------------------------------------
info "Setup complete."
cat <<EOF

Next steps:
  1. Add your key to $LOOP_DIR/.env.local
       OPENAI_API_KEY=sk-...
     (needs OpenAI Realtime API access + credit)
  2. npm run dev
  3. Open http://localhost:3000   (use localhost, not the LAN IP — the mic needs a secure context)
EOF
