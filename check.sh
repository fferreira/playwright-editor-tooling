#!/usr/bin/env bash
#
# The gate for the Playwright editor tooling.
#
# Usage:
#   ./check.sh                  every category
#   ./check.sh <category>...    only those, in the order below
#
# Categories:
#
#   grammar   tree-sitter-playwright-core:
#               corpus       tree-sitter test: the shapes test/corpus pins
#               rust         cargo test: the Rust binding loads the grammar and parses
#               core         every .core file playwright-core ships parses with no ERROR
#
#   vscode    vscode-playwright:
#               syntax       the .play highlighting grammar's assertion files, and
#                            every .play playwright-core ships tokenized with no
#                            region left open
#               compiler     build.sh: playc-web built from playwright-core and staged
#               unit         node --test: src/ against the real compiler
#               package      build_vsix.sh, and the .vsix holds what it should
#               integration  the packaged .vsix driven inside VS Code or VSCodium.
#                            Off by default, because it opens a window:
#                            VSCODE_TEST=1 ./check.sh vscode
#
# Several steps need a playwright-core checkout, found by tools/core_dir.sh:
# $CORE_DIR, then ../core (this repository as playwright's editor-tooling/
# submodule), then ../playwright-core. **A step that cannot run says so**, at
# the end, under SKIPPED: a skip looks exactly like a pass.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
GRAMMAR="$ROOT/tree-sitter-playwright-core"
VSCODE="$ROOT/vscode-playwright"

CATEGORIES_ALL="grammar vscode"
SELECTED=""
for arg in "$@"; do
	case "$arg" in
	-h | --help)
		sed -n '3,/^set -euo pipefail$/p' "$0" | sed '$d; s/^# \{0,1\}//'
		exit 0
		;;
	grammar | vscode) SELECTED="${SELECTED:+$SELECTED }$arg" ;;
	*)
		echo "unknown category: $arg (categories: $CATEGORIES_ALL)" >&2
		exit 2
		;;
	esac
done
SELECTED="${SELECTED:-$CATEGORIES_ALL}"
want() { case " $SELECTED " in *" $1 "*) return 0 ;; *) return 1 ;; esac; }

PASSED=""
SKIPPED=""
pass() { PASSED="${PASSED:+$PASSED, }$1"; }
skip() {
	echo "SKIP: $1 — $2"
	SKIPPED="${SKIPPED}  $1 — $2"$'\n'
}

CORE="$("$ROOT/tools/core_dir.sh")" || CORE=""
NO_CORE="no playwright-core checkout; set CORE_DIR to one"

# The tree-sitter CLI: local node_modules, PATH, or a global npm install —
# the same search as tree-sitter-playwright-core/scripts/generate.sh.
tree_sitter() {
	if [ -x "$GRAMMAR/node_modules/.bin/tree-sitter" ]; then
		"$GRAMMAR/node_modules/.bin/tree-sitter" "$@"
	elif command -v tree-sitter >/dev/null 2>&1; then
		tree-sitter "$@"
	elif command -v npm >/dev/null 2>&1 && [ -x "$(npm root -g)/tree-sitter-cli/tree-sitter" ]; then
		"$(npm root -g)/tree-sitter-cli/tree-sitter" "$@"
	else
		echo "FAILED: the tree-sitter CLI is not installed: npm install -g tree-sitter-cli" >&2
		exit 1
	fi
}

if [ -n "$CORE" ]; then
	echo "==> playwright-core at $CORE ($(git -C "$CORE" describe --tags --always --dirty 2>/dev/null || echo 'not a git checkout'))"
else
	echo "==> no playwright-core checkout found"
fi
echo

# --- grammar: tree-sitter-playwright-core -------------------------------------

if want grammar; then
	echo "==> grammar/corpus: tree-sitter test"
	(cd "$GRAMMAR" && tree_sitter test)
	pass "grammar/corpus"
	echo

	echo "==> grammar/rust: cargo test"
	(cd "$GRAMMAR" && cargo test --quiet)
	pass "grammar/rust"
	echo

	if [ -n "$CORE" ]; then
		echo "==> grammar/core: parsing playwright-core's .core files"
		list="$(mktemp)"
		# The symlinked fixtures point at files already in the list.
		git -C "$CORE" ls-files '*.core' | while IFS= read -r f; do
			[ -L "$CORE/$f" ] || echo "$CORE/$f"
		done >"$list"
		status=0
		(cd "$GRAMMAR" && tree_sitter parse -p . --quiet --stat --paths "$list") || status=$?
		rm -f "$list"
		[ "$status" = 0 ] || exit "$status"
		pass "grammar/core"
		echo
	else
		skip "grammar/core" "$NO_CORE"
	fi
fi

# --- vscode: vscode-playwright --------------------------------------------------

if want vscode; then
	HAVE_NODE_MODULES=0
	[ -x "$VSCODE/node_modules/.bin/vscode-tmgrammar-test" ] && [ -x "$VSCODE/node_modules/.bin/vsce" ] && HAVE_NODE_MODULES=1
	NO_NODE_MODULES="its dev tools are not installed; run 'npm ci' in vscode-playwright"

	if [ "$HAVE_NODE_MODULES" = 1 ]; then
		echo "==> vscode/syntax: the highlighting grammar"
		(cd "$VSCODE" && npm run --silent test:syntax)
		if [ -n "$CORE" ]; then
			(cd "$VSCODE" && node test/syntax/balance.cjs "$CORE")
			pass "vscode/syntax"
		else
			pass "vscode/syntax (assertions only)"
			skip "vscode/syntax balance" "$NO_CORE"
		fi
		echo
	else
		skip "vscode/syntax" "$NO_NODE_MODULES"
	fi

	# The compiler gates everything after it: without it there is nothing to
	# test, package or run. Check for the tools first, so a machine without the
	# wasm toolchain gets a SKIP naming what is missing rather than a failure.
	COMPILER_WHY=""
	if [ -z "$CORE" ]; then
		COMPILER_WHY="$NO_CORE"
	else
		missing=""
		for tool in dune wasm_of_ocaml wasm-merge; do
			command -v "$tool" >/dev/null 2>&1 || missing="${missing:+$missing, }$tool"
		done
		[ -z "$missing" ] || COMPILER_WHY="playc-web cannot be built without $missing"
	fi

	if [ -z "$COMPILER_WHY" ]; then
		echo "==> vscode/compiler: build.sh"
		"$VSCODE/build.sh"
		pass "vscode/compiler"
		echo

		echo "==> vscode/unit: node --test"
		(cd "$VSCODE" && node --test --test-reporter=dot test/unit/)
		pass "vscode/unit"
		echo

		if [ "$HAVE_NODE_MODULES" = 1 ]; then
			# The script an author runs, not a copy of its steps, so the gate
			# checks the .vsix people actually build.
			echo "==> vscode/package: build_vsix.sh"
			out="$(mktemp -d)"
			"$ROOT/build_vsix.sh" "$out" >/dev/null
			vsix="$(ls "$out"/*.vsix)"
			listing="$(unzip -l "$vsix")"
			for expect in extension/extension.js extension/compiler/playc_web.js \
				extension/compiler/playc_web.assets/ extension/syntaxes/playwright.tmLanguage.json \
				extension/src/diagnostics.js extension/icon.png; do
				grep -q "$expect" <<<"$listing" || {
					echo "FAILED: vscode/package — the .vsix has no $expect" >&2
					exit 1
				}
			done
			for unwanted in extension/test/ extension/node_modules/ extension/scripts/; do
				if grep -q "$unwanted" <<<"$listing"; then
					echo "FAILED: vscode/package — the .vsix carries $unwanted" >&2
					exit 1
				fi
			done
			echo "$(basename "$vsix"): $(wc -c <"$vsix" | tr -d ' ') bytes"
			pass "vscode/package"
			echo

			if [ -n "${VSCODE_TEST:-}" ]; then
				echo "==> vscode/integration: the .vsix inside the editor"
				status=0
				node "$VSCODE/test/integration/launch.cjs" "$vsix" || status=$?
				case "$status" in
				0) pass "vscode/integration" ;;
				77) skip "vscode/integration" "no VS Code or VSCodium found; set VSCODE_BIN" ;;
				*) exit "$status" ;;
				esac
				echo
			else
				skip "vscode/integration" "off by default; VSCODE_TEST=1 ./check.sh vscode"
			fi
			rm -rf "$out"
		else
			skip "vscode/package" "$NO_NODE_MODULES"
			skip "vscode/integration" "$NO_NODE_MODULES"
		fi
	else
		for step in compiler unit package integration; do skip "vscode/$step" "$COMPILER_WHY"; done
	fi
fi

if [ -n "$PASSED" ]; then
	echo "✅ passed: $PASSED"
else
	echo "NOTHING RAN: every step selected was skipped"
fi
if [ -n "$SKIPPED" ]; then
	echo "SKIPPED:"
	printf '%s' "$SKIPPED"
fi
