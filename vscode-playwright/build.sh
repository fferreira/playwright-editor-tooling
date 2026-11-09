#!/usr/bin/env bash
#
# Stage the compiler this extension carries: playc-web, the Playwright compiler
# built to WebAssembly by playwright-core, into compiler/.
#
#   compiler/playc_web.js       the loader, patched to find its .wasm beside
#                               itself (scripts/patch-loader.cjs says why)
#   compiler/playc_web.assets/  the compiler
#   compiler/VERSION            the playwright-core version it was built from
#
# compiler/ is generated and gitignored. `vsce package` runs this first (it is
# the `vscode:prepublish` script), so a .vsix always carries a fresh build of
# the core this repository finds — see tools/core_dir.sh for where it looks.
#
# It fails rather than skipping: an extension without its compiler is not a
# smaller extension, it is a broken one. ../check.sh is what turns a missing
# toolchain into a SKIP that says so.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

if ! CORE="$("$ROOT/tools/core_dir.sh")"; then
	echo "FAILED: no playwright-core checkout: set CORE_DIR, or check this" >&2
	echo "        repository out as playwright's editor-tooling/ submodule" >&2
	exit 1
fi
if ! command -v dune >/dev/null 2>&1; then
	echo "FAILED: dune is not on PATH, so playc-web cannot be built" >&2
	exit 1
fi

# The bundle's rules are `enabled_if` on wasm_of_ocaml and wasm-merge, so with
# dune but no wasm toolchain this builds nothing and exits 0. Check for the
# artifact rather than the tool, or the failure surfaces as a bare "cp: cannot
# stat", which is a message about the wrong thing.
(cd "$CORE/play" && dune build @playc/web/web)
BUNDLE="$CORE/play/_build/default/playc/web"
if [ ! -f "$BUNDLE/playc_web.js" ] || [ ! -d "$BUNDLE/playc_web.assets" ]; then
	echo "FAILED: playc-web was not built; the wasm toolchain is incomplete:" >&2
	for tool in wasm_of_ocaml wasm-merge wasm-opt; do
		command -v "$tool" >/dev/null 2>&1 || echo "        $tool is missing" >&2
	done
	exit 1
fi

# dune leaves _build read-only, so a copy over a previous stage would fail with
# "Permission denied". Remove first, then make the copies writable so the next
# build can do the same.
rm -rf "$HERE/compiler"
mkdir -p "$HERE/compiler"
cp -R "$BUNDLE/playc_web.assets" "$HERE/compiler/"
node "$HERE/scripts/patch-loader.cjs" "$BUNDLE/playc_web.js" "$HERE/compiler/playc_web.js"
chmod -R u+w "$HERE/compiler"

# core's version, read from core's git. PLAYWRIGHT_VERSION is unset because
# playwright's check.sh exports its *own* version under that name, and core's
# version.sh would report that instead.
(cd "$CORE" && env -u PLAYWRIGHT_VERSION ./tools/version.sh) >"$HERE/compiler/VERSION"

echo "playc-web staged in compiler/ from playwright-core $(cat "$HERE/compiler/VERSION")"
