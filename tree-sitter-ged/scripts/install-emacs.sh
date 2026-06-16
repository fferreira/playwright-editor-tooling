#!/usr/bin/env bash
# install-emacs.sh — compile the GED tree-sitter shared library and install
#                    ged-ts-mode.el for Emacs 29+ built-in tree-sitter support.
#
# Idempotent: safe to run multiple times.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PARSER_C="$CRATE_DIR/src/parser.c"
EL_SRC="$CRATE_DIR/editors/ged-ts-mode.el"

# ── Determine shared library suffix ─────────────────────────────────────────
case "$(uname -s)" in
    Darwin) SOEXT="dylib" ;;
    *)      SOEXT="so"    ;;
esac

LIB_NAME="libtree-sitter-ged.$SOEXT"

# Emacs looks for tree-sitter grammars in `treesit-extra-load-path` or the
# default directory ~/.emacs.d/tree-sitter/.  We install into the latter.
TREESIT_DIR="${EMACS_TREESIT_DIR:-$HOME/.emacs.d/tree-sitter}"
LISP_DIR="${EMACS_LISP_DIR:-$HOME/.emacs.d/lisp}"

mkdir -p "$TREESIT_DIR" "$LISP_DIR"

# ── Compile the shared library ───────────────────────────────────────────────
LIB_OUT="$TREESIT_DIR/$LIB_NAME"

echo "Compiling $LIB_NAME from $PARSER_C …"
cc \
    -shared \
    -fPIC \
    -o "$LIB_OUT" \
    -I "$CRATE_DIR/src" \
    "$PARSER_C" \
    -Wno-unused-parameter \
    -Wno-unused-but-set-variable 2>/dev/null || \
cc \
    -shared \
    -fPIC \
    -o "$LIB_OUT" \
    -I "$CRATE_DIR/src" \
    "$PARSER_C"
echo "Installed: $LIB_OUT"

# ── Install ged-ts-mode.el ────────────────────────────────────────────────────
EL_DST="$LISP_DIR/ged-ts-mode.el"
cp "$EL_SRC" "$EL_DST"
echo "Installed: $EL_DST"

# ── Patch init.el (idempotent) ────────────────────────────────────────────────
INIT_FILE="${EMACS_INIT:-$HOME/.emacs.d/init.el}"
MARKER=";;; >>> tree-sitter-ged"

if [ -f "$INIT_FILE" ] && grep -q "$MARKER" "$INIT_FILE"; then
    echo "init.el: GED block already present (skipping)"
else
    if [ -f "$INIT_FILE" ]; then
        echo "Patching $INIT_FILE …"
        cat >> "$INIT_FILE" << ELISP

$MARKER
(add-to-list 'load-path "$LISP_DIR")
(require 'ged-ts-mode)
;;; <<< tree-sitter-ged
ELISP
        echo "Patched $INIT_FILE"
    else
        echo ""
        echo "Could not find init.el at $INIT_FILE."
        echo "Add the following to your Emacs init file manually:"
        echo ""
        echo "  (add-to-list 'load-path \"$LISP_DIR\")"
        echo "  (require 'ged-ts-mode)"
    fi
fi

echo ""
echo "Done."
echo ""
echo "To verify in Emacs:"
echo "  M-x treesit-available-p          ; should return t"
echo "  (treesit-language-available-p 'ged) ; should return t after loading"
echo "  M-x ged-ts-mode                  ; on any .ged buffer"
