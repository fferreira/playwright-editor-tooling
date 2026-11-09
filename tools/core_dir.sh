#!/usr/bin/env bash
#
# Print the absolute path of the playwright-core checkout this repository's
# tools work against, or exit 1 if there is none.
#
# Nothing here is part of core, but two things need it: check.sh parses core's
# .core files with the tree-sitter grammar, and the VS Code extension carries
# playc-web, which core builds. Both look in the same three places, in order:
#
#   $CORE_DIR            whatever the caller says
#   ../core              this repository as playwright's editor-tooling/
#                        submodule, beside playwright's own core/
#   ../playwright-core   the two repositories checked out side by side
#
# play/lib/grammar.mly is what tells a playwright-core checkout from any other
# directory of that name: it is the grammar the tree-sitter one follows.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for dir in "${CORE_DIR:-}" "$ROOT/../core" "$ROOT/../playwright-core"; do
	if [ -n "$dir" ] && [ -f "$dir/play/lib/grammar.mly" ]; then
		(cd "$dir" && pwd)
		exit 0
	fi
done
exit 1
