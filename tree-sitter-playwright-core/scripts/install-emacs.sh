#!/usr/bin/env bash
# install-emacs.sh — compile the CORE tree-sitter shared library and install
#                    playwright-core-ts-mode.el for Emacs 29+ built-in tree-sitter support.
#
# Idempotent: safe to run multiple times.
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
CRATE_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

PARSER_C="$CRATE_DIR/src/parser.c"
EL_SRC="$CRATE_DIR/editors/playwright-core-ts-mode.el"

# ── Determine shared library suffix ─────────────────────────────────────────
case "$(uname -s)" in
    Darwin) SOEXT="dylib" ;;
    *)      SOEXT="so"    ;;
esac

# Emacs derives the file it loads from the *language* name, `playwright_core`,
# so the underscore is not a typo: libtree-sitter-playwright_core. A hyphen
# here installs a library Emacs never looks for, and treesit then reports the
# language unavailable with nothing pointing at the name.
LIB_NAME="libtree-sitter-playwright_core.$SOEXT"
# What earlier versions of this script installed, under the name Emacs ignores.
OLD_LIB_NAME="libtree-sitter-playwright-core.$SOEXT"

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
if [ -f "$TREESIT_DIR/$OLD_LIB_NAME" ]; then
    rm -f "$TREESIT_DIR/$OLD_LIB_NAME"
    echo "Removed:   $TREESIT_DIR/$OLD_LIB_NAME (the old, misnamed copy)"
fi

# ── Install playwright-core-ts-mode.el ────────────────────────────────────────────────────
EL_DST="$LISP_DIR/playwright-core-ts-mode.el"
cp "$EL_SRC" "$EL_DST"
echo "Installed: $EL_DST"

# ── Patch init.el (idempotent) ────────────────────────────────────────────────
INIT_FILE="${EMACS_INIT:-$HOME/.emacs.d/init.el}"
MARKER=";;; >>> tree-sitter-playwright-core"

if [ -f "$INIT_FILE" ] && grep -q "$MARKER" "$INIT_FILE"; then
    echo "init.el: CORE block already present (skipping)"
else
    if [ -f "$INIT_FILE" ]; then
        echo "Patching $INIT_FILE …"
        cat >> "$INIT_FILE" << ELISP

$MARKER
(add-to-list 'load-path "$LISP_DIR")
(require 'playwright-core-ts-mode)
;;; <<< tree-sitter-playwright-core
ELISP
        echo "Patched $INIT_FILE"
    else
        echo ""
        echo "Could not find init.el at $INIT_FILE."
        echo "Add the following to your Emacs init file manually:"
        echo ""
        echo "  (add-to-list 'load-path \"$LISP_DIR\")"
        echo "  (require 'playwright-core-ts-mode)"
    fi
fi

echo ""
echo "Done."
echo ""
echo "To verify in Emacs:"
echo "  M-x treesit-available-p          ; should return t"
echo "  (treesit-language-available-p 'playwright_core) ; should return t after loading"
echo "  M-x playwright-core-ts-mode                  ; on any .core buffer"
