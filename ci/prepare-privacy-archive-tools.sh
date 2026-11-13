#!/usr/bin/env bash
set -euo pipefail
: "${RUNNER_TEMP:?Owned runner temporary directory required}"
: "${GITHUB_PATH:?Runner path export required}"
if command -v 7zz >/dev/null 2>&1; then
  7zz i >> "$RUNNER_TEMP/hear-private.log" 2>&1
  exit 0
fi
seven_zip="$(command -v 7z)"
test -f "$seven_zip" && test -x "$seven_zip"
owned_bin="$RUNNER_TEMP/privacy-bin"
mkdir -p "$owned_bin"
test ! -e "$owned_bin/7zz" && test ! -L "$owned_bin/7zz"
ln -s "$seven_zip" "$owned_bin/7zz"
"$owned_bin/7zz" i >> "$RUNNER_TEMP/hear-private.log" 2>&1
printf '%s\n' "$owned_bin" >> "$GITHUB_PATH"
