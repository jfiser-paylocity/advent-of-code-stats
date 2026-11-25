#!/usr/bin/env sh
# Installs the pinned Deno version used by this project.
# Usage: scripts/install-deno.sh
set -eu

DENO_VERSION="2.9.8"
DENO_INSTALL="${DENO_INSTALL:-$HOME/.deno}"
export DENO_INSTALL

if command -v deno >/dev/null 2>&1 && [ "$(deno --version | head -n1 | cut -d' ' -f2)" = "$DENO_VERSION" ]; then
  echo "Deno $DENO_VERSION already installed."
  exit 0
fi

curl -fsSL https://deno.land/install.sh | sh -s -- "v$DENO_VERSION" --no-modify-path

echo
echo "Installed Deno $DENO_VERSION to $DENO_INSTALL/bin"
echo "Ensure it is on PATH, e.g. add to ~/.zshrc:"
echo "  export PATH=\"$DENO_INSTALL/bin:\$PATH\""
