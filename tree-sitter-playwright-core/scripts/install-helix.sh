#!/usr/bin/env bash
# install-helix.sh — wire tree-sitter-playwright-core into the Helix editor
#
# Idempotent: safe to run multiple times.
# Run from any directory; it uses absolute paths throughout.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# ── Locate Helix config dir ─────────────────────────────────────────────────
HX_CFG="${XDG_CONFIG_HOME:-$HOME/.config}/helix"
mkdir -p "$HX_CFG"

LANG_TOML="$HX_CFG/languages.toml"
QUERIES_DIR="$HX_CFG/runtime/queries/playwright_core"

MARKER_START="# >>> tree-sitter-playwright-core"
MARKER_END="# <<< tree-sitter-playwright-core"

# ── languages.toml ──────────────────────────────────────────────────────────
if grep -q "$MARKER_START" "$LANG_TOML" 2>/dev/null; then
    echo "languages.toml: CORE block already present (skipping)"
else
    echo "languages.toml: adding CORE language and grammar entries"
    cat >> "$LANG_TOML" << TOML

$MARKER_START
[[language]]
name = "playwright_core"
scope = "source.playwright-core"
file-types = ["playwright_core"]
grammar = "playwright_core"
comment-token = "//"
indent = { tab-width = 4, unit = "    " }

[[grammar]]
name = "playwright_core"
source = { path = "$CRATE_DIR" }
$MARKER_END
TOML
fi

# ── Query files ─────────────────────────────────────────────────────────────
mkdir -p "$QUERIES_DIR"
for qfile in highlights indents injections; do
    src="$CRATE_DIR/queries/${qfile}.scm"
    dst="$QUERIES_DIR/${qfile}.scm"
    if [ -f "$src" ]; then
        cp "$src" "$dst"
        echo "Copied queries/${qfile}.scm → $dst"
    fi
done

# Helix uses 'indent.scm' (singular); also copy as that name if needed
if [ -f "$CRATE_DIR/queries/indents.scm" ] && [ ! -f "$QUERIES_DIR/indent.scm" ]; then
    cp "$CRATE_DIR/queries/indents.scm" "$QUERIES_DIR/indent.scm"
    echo "Copied queries/indents.scm → $QUERIES_DIR/indent.scm"
fi

# ── Build grammars ─────────────────────────────────────────────────────────
# The grammars dir must exist before hx --grammar build or the linker silently fails.
mkdir -p "$HX_CFG/runtime/grammars"

if command -v hx >/dev/null 2>&1; then
    echo "Compiling the grammar (hx --grammar build)…"
    # Suppress the flood of "Failure: ... did you use hx --grammar fetch?" lines
    # for built-in grammars; only print grammar-specific failures if any.
    hx --grammar build 2>&1 | grep -i 'failure.*playwright_core\|playwright_core.*fail' || true
    GRAMMAR_SO="$HX_CFG/runtime/grammars/playwright_core.so"
    if [ -f "$GRAMMAR_SO" ]; then
        echo "grammar compiled: $GRAMMAR_SO"
    else
        echo "ERROR: $GRAMMAR_SO was not produced — compilation failed." >&2
        exit 1
    fi
    echo ""
    echo "Run 'hx --health playwright_core' to verify the installation."
else
    echo ""
    echo "Note: 'hx' not found on PATH."
    echo "After installing Helix, run: hx --grammar build"
    echo "Then verify with:           hx --health playwright_core"
fi

echo ""
echo "Done.  Open any `.core` file in Helix to see syntax highlighting."
