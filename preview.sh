#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ASAR="$SCRIPT_DIR/release/mac-arm64/MicroClawDesktop.app/Contents/Resources/app.asar"
TEMP_DIR="/tmp/microclaw_preview_$$"

cd "$SCRIPT_DIR"

echo "▶ Building renderer..."
cd renderer && npx vite build --mode development --logLevel warn
cd "$SCRIPT_DIR"

echo "▶ Updating app bundle..."
npx @electron/asar extract "$ASAR" "$TEMP_DIR"
rm -rf "$TEMP_DIR/renderer/dist"
cp -r "$SCRIPT_DIR/renderer/dist" "$TEMP_DIR/renderer/dist"
npx @electron/asar pack "$TEMP_DIR" "$ASAR"
rm -rf "$TEMP_DIR"

echo "▶ Launching..."
open "$SCRIPT_DIR/release/mac-arm64/MicroClawDesktop.app"
