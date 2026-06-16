#!/usr/bin/env bash
# install-helix.sh — wire tree-sitter-ged into the Helix editor
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
QUERIES_DIR="$HX_CFG/runtime/queries/ged"

MARKER_START="# >>> tree-sitter-ged"
MARKER_END="# <<< tree-sitter-ged"

# ── languages.toml ──────────────────────────────────────────────────────────
if grep -q "$MARKER_START" "$LANG_TOML" 2>/dev/null; then
    echo "languages.toml: GED block already present (skipping)"
else
    echo "languages.toml: adding GED language and grammar entries"
    cat >> "$LANG_TOML" << TOML

$MARKER_START
[[language]]
name = "ged"
scope = "source.ged"
file-types = ["ged"]
grammar = "ged"
comment-token = "//"
indent = { tab-width = 4, unit = "    " }

[[grammar]]
name = "ged"
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
    echo "Compiling ged grammar (hx --grammar build)…"
    # Suppress the flood of "Failure: ... did you use hx --grammar fetch?" lines
    # for built-in grammars; only print ged-specific failures if any.
    hx --grammar build 2>&1 | grep -i 'failure.*ged\|ged.*fail' || true
    GED_SO="$HX_CFG/runtime/grammars/ged.so"
    if [ -f "$GED_SO" ]; then
        echo "ged grammar compiled: $GED_SO"
    else
        echo "ERROR: $GED_SO was not produced — compilation failed." >&2
        exit 1
    fi
    echo ""
    echo "Run 'hx --health ged' to verify the installation."
else
    echo ""
    echo "Note: 'hx' not found on PATH."
    echo "After installing Helix, run: hx --grammar build"
    echo "Then verify with:           hx --health ged"
fi

echo ""
echo "Done.  Open any .ged file in Helix to see syntax highlighting."
