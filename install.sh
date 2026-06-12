#!/bin/bash
# Install pi-pro as a pi-mono extension.
#
# This script:
#   1. Installs oficial pi (pi-mono) if not present (via curl https://pi.dev/install.sh)
#   2. Registers the pi-pro extension in ~/.pi/agent/settings.json
#   3. Symlinks ~/.local/bin/pi -> ~/.npm-global/bin/pi (so 'pi' works
#      regardless of which dir is first in PATH)
#
# Idempotent: safe to re-run.
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXT_SRC="$SCRIPT_DIR/packages/pi-pro-ext"

if [ ! -f "$EXT_SRC/package.json" ]; then
  echo "error: $EXT_SRC/package.json not found"
  exit 1
fi

# Step 1: ensure oficial pi is installed
if ! command -v pi >/dev/null 2>&1; then
  echo "  ! oficial pi not found; installing via curl https://pi.dev/install.sh"
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL https://pi.dev/install.sh | sh
  else
    echo "  ! curl not found; install @earendil-works/pi-coding-agent manually:"
    echo "    npm i -g @earendil-works/pi-coding-agent"
    exit 1
  fi
fi

# Step 2: ensure the npm-global bin symlink exists (--ignore-scripts skipped it)
if [ ! -e "$HOME/.npm-global/bin/pi" ] && [ -e "$HOME/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js" ]; then
  mkdir -p "$HOME/.npm-global/bin"
  ln -sf "$HOME/.npm-global/lib/node_modules/@earendil-works/pi-coding-agent/dist/cli.js" "$HOME/.npm-global/bin/pi"
  echo "  ✓ created ~/.npm-global/bin/pi symlink"
fi

# Step 3: re-symlink ~/.local/bin/pi -> ~/.npm-global/bin/pi
# (Sid's shell has ~/.local/bin earlier in PATH than ~/.npm-global/bin.
# The symlink garantees 'pi' resolves to the oficial binary even when
# PATH order varies between terminal sessions.)
if [ -d "$HOME/.local/bin" ] && [ -e "$HOME/.npm-global/bin/pi" ]; then
  ln -sf "$HOME/.npm-global/bin/pi" "$HOME/.local/bin/pi"
  echo "  ✓ re-symlinked ~/.local/bin/pi -> ~/.npm-global/bin/pi"
fi

# Step 4: register the extension in ~/.pi/agent/settings.json
SETTINGS="$HOME/.pi/agent/settings.json"
if [ ! -f "$SETTINGS" ]; then
  mkdir -p "$HOME/.pi/agent"
  echo '{"packages":[],"extensions":[]}' > "$SETTINGS"
fi

if grep -q "$EXT_SRC" "$SETTINGS" 2>/dev/null; then
  echo "  ✓ extension already registered in settings.json"
else
  node -e "
    const fs = require('node:fs');
    const p = process.argv[1];
    let s = {};
    try { s = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { s = {}; }
    s.extensions = s.extensions || [];
    const src = process.argv[2];
    if (!s.extensions.includes(src)) s.extensions.push(src);
    fs.writeFileSync(p, JSON.stringify(s, null, 2) + '\n');
  " "$SETTINGS" "$EXT_SRC"
  echo "  ✓ registered extension in settings.json"
fi

# Step 5: confirm
echo
PI_VERSION=$(pi --version 2>/dev/null | grep -E "^[0-9]" | head -1 || echo "?")
echo "  ✓ pi v$PI_VERSION is ready (with pi-pro extension loaded)"
echo
echo "  type 'pi' to launch. in REPL try: :doctor, :mode, :plan, :todos"
