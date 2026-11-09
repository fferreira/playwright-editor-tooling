#!/usr/bin/env bash
#
# The gate for the Playwright editor tooling. Three checks, in this order:
#
#   corpus   tree-sitter test: the shapes tree-sitter-playwright-core/test/corpus pins
#   rust     cargo test: the Rust binding loads the grammar and parses with it
#   core     every .core file playwright-core ships parses without an ERROR node
#
# Usage: ./check.sh
#
# `core` is the check that the grammar has not fallen behind the language, and
# it needs a checkout of playwright-core. It looks at $CORE_DIR, then ../core
# (where core is when this repository is playwright's editor-tooling/
# submodule), then ../playwright-core (the two repositories side by side). If it
# finds none of them it prints SKIP and says why, because a skip looks exactly
# like a pass.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
GRAMMAR="$ROOT/tree-sitter-playwright-core"
cd "$GRAMMAR"

# The tree-sitter CLI: local node_modules, PATH, or a global npm install —
# the same search as scripts/generate.sh.
if [ -x "node_modules/.bin/tree-sitter" ]; then
	TS="node_modules/.bin/tree-sitter"
elif command -v tree-sitter >/dev/null 2>&1; then
	TS="tree-sitter"
elif command -v npm >/dev/null 2>&1 && [ -x "$(npm root -g)/tree-sitter-cli/tree-sitter" ]; then
	TS="$(npm root -g)/tree-sitter-cli/tree-sitter"
else
	echo "FAILED: the tree-sitter CLI is not installed: npm install -g tree-sitter-cli" >&2
	exit 1
fi

echo "==> corpus: tree-sitter test"
"$TS" test
echo

echo "==> rust: cargo test"
cargo test --quiet
echo

echo "==> core: parsing playwright-core's .core files"
core=""
for dir in "${CORE_DIR:-}" "$ROOT/../core" "$ROOT/../playwright-core"; do
	# grammar.mly is the grammar this one follows, so it is also what tells a
	# playwright-core checkout from any other directory of that name.
	if [ -n "$dir" ] && [ -f "$dir/play/lib/grammar.mly" ]; then
		core="$(cd "$dir" && pwd)"
		break
	fi
done
if [ -z "$core" ]; then
	echo "SKIP: core: no playwright-core checkout found; set CORE_DIR to one"
	exit 0
fi
echo "   playwright-core at $core ($(git -C "$core" describe --tags --always --dirty 2>/dev/null || echo 'not a git checkout'))"
list="$(mktemp)"
trap 'rm -f "$list"' EXIT
# The symlinked fixtures point at files already in the list.
git -C "$core" ls-files '*.core' | while IFS= read -r f; do
	[ -L "$core/$f" ] || echo "$core/$f"
done >"$list"
"$TS" parse -p . --quiet --stat --paths "$list"
echo
echo "✅ editor tooling: corpus, rust and core all passed"
