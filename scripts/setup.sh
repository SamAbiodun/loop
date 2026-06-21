#!/usr/bin/env bash
#
# One-shot setup for the loop DSA voice interview app.
# Run after cloning:  bash scripts/setup.sh
#
# It clones + builds the sibling realtime-voice-component (not on npm),
# copy-installs loop's dependencies, and seeds .env.local.

set -euo pipefail

REQUIRED_NODE_MAJOR=20
REQUIRED_NODE_MINOR=9
COMPONENT_REPO="https://github.com/openai/realtime-voice-component"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOOP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PARENT_DIR="$(dirname "$LOOP_DIR")"
COMPONENT_DIR="$PARENT_DIR/realtime-voice-component"

info() { printf '\033[1;34m==>\033[0m %s\n' "$1"; }
warn() { printf '\033[1;33m !\033[0m %s\n' "$1"; }
fail() { printf '\033[1;31m x\033[0m %s\n' "$1" >&2; exit 1; }

# --- 1. Prerequisites --------------------------------------------------------
command -v git  >/dev/null 2>&1 || fail "git is not installed."
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

# --- 2. Sibling voice component ----------------------------------------------
if [ -d "$COMPONENT_DIR/.git" ]; then
  info "Found realtime-voice-component at $COMPONENT_DIR"
else
  info "Cloning realtime-voice-component -> $COMPONENT_DIR"
  git clone "$COMPONENT_REPO" "$COMPONENT_DIR"
fi

# --- 3. Build it (the package ships from dist/, absent on a fresh clone) ------
info "Building realtime-voice-component"
( cd "$COMPONENT_DIR" && npm install --no-audit --no-fund --loglevel=error && npm run build )

# --- 4. Install loop deps, copying the component (Turbopack can't follow the
#        file: symlink, so --install-links is required) -----------------------
info "Installing loop dependencies (--install-links)"
( cd "$LOOP_DIR" && npm install --install-links --no-audit --no-fund --loglevel=error )

# --- 5. Env file -------------------------------------------------------------
if [ -f "$LOOP_DIR/.env.local" ]; then
  info ".env.local already exists — leaving it untouched"
elif [ -f "$LOOP_DIR/.env.local.example" ]; then
  cp "$LOOP_DIR/.env.local.example" "$LOOP_DIR/.env.local"
  warn "Created .env.local from the example — add your OPENAI_API_KEY before running."
else
  printf 'OPENAI_API_KEY=\n' > "$LOOP_DIR/.env.local"
  warn "Created an empty .env.local — add your OPENAI_API_KEY before running."
fi

# --- 6. Done -----------------------------------------------------------------
info "Setup complete."
cat <<EOF

Next steps:
  1. Add your key to $LOOP_DIR/.env.local
       OPENAI_API_KEY=sk-...
     (needs OpenAI Realtime API access + credit)
  2. npm run dev
  3. Open http://localhost:3000   (use localhost, not the LAN IP — the mic needs a secure context)
EOF
