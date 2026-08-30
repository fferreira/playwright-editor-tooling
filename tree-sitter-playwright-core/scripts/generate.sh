#!/usr/bin/env bash
# generate.sh — regenerate src/parser.c from grammar.js
# Run this whenever grammar.js is changed.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$SCRIPT_DIR/.."

# Try to find tree-sitter CLI: local node_modules, global npm, or PATH
if [ -x "node_modules/.bin/tree-sitter" ]; then
    TS="node_modules/.bin/tree-sitter"
elif command -v tree-sitter >/dev/null 2>&1; then
    TS="tree-sitter"
elif [ -x "$(npm root -g)/tree-sitter-cli/tree-sitter" ]; then
    TS="$(npm root -g)/tree-sitter-cli/tree-sitter"
else
    echo "Error: tree-sitter CLI not found." >&2
    echo "Install with: npm install -g tree-sitter-cli" >&2
    exit 1
fi

echo "Using tree-sitter: $TS"
"$TS" generate
echo "Done. Generated src/parser.c and friends."
