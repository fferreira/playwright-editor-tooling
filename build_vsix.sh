#!/usr/bin/env bash
#
# Build the VS Code extension: vscode-playwright-<version>.vsix.
#
# Usage:
#   ./build_vsix.sh               write it into vscode-playwright/
#   ./build_vsix.sh <directory>   write it into that directory
#   ./build_vsix.sh <file>.vsix   write it to that file
#
# Then install it with `code --install-extension <file>.vsix`, or `codium`.
#
# What it does, in order:
#
#   1. `npm ci` in vscode-playwright/, if its dev tools are missing or older
#      than package-lock.json. vsce, the packager, is one of them.
#   2. `vsce package`. That runs vscode-playwright/build.sh first (it is the
#      `vscode:prepublish` script), which builds playc-web from playwright-core
#      and stages it in compiler/. So every .vsix carries a fresh build of the
#      core that tools/core_dir.sh finds: $CORE_DIR, then ../core, then
#      ../playwright-core.
#
# Building the compiler needs dune, wasm_of_ocaml and binaryen; build.sh names
# whichever is missing. This builds and does not test: ./check.sh vscode is the
# gate, and its package step runs this script.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
VSCODE="$ROOT/vscode-playwright"

case "${1:-}" in
-h | --help)
	sed -n '3,/^set -euo pipefail$/p' "$0" | sed '$d; s/^# \{0,1\}//'
	exit 0
	;;
esac
if [ "$#" -gt 1 ]; then
	echo "usage: $0 [<directory> | <file>.vsix]" >&2
	exit 2
fi

for tool in node npm; do
	if ! command -v "$tool" >/dev/null 2>&1; then
		echo "FAILED: $tool is not on PATH" >&2
		exit 1
	fi
done

VERSION="$(node -p "require('$VSCODE/package.json').version")"
NAME="$(node -p "require('$VSCODE/package.json').name")"

# Where the .vsix goes, resolved against the caller's directory now, because
# vsce runs from vscode-playwright/. vsce reads a trailing slash as "a
# directory, name the file yourself".
if [ "$#" = 0 ]; then
	OUT="$VSCODE/"
	VSIX="$VSCODE/$NAME-$VERSION.vsix"
elif [ -d "$1" ]; then
	OUT="$(cd "$1" && pwd)/"
	VSIX="$OUT$NAME-$VERSION.vsix"
else
	parent="$(dirname "$1")"
	if [ ! -d "$parent" ]; then
		echo "FAILED: $parent does not exist" >&2
		exit 1
	fi
	OUT="$(cd "$parent" && pwd)/$(basename "$1")"
	VSIX="$OUT"
fi

# npm writes node_modules/.package-lock.json on every install, so a lockfile
# newer than it means the tools on disk are not the ones the lockfile names.
if [ ! -x "$VSCODE/node_modules/.bin/vsce" ] ||
	[ "$VSCODE/package-lock.json" -nt "$VSCODE/node_modules/.package-lock.json" ]; then
	echo "==> npm ci (vscode-playwright's dev tools)"
	(cd "$VSCODE" && npm ci --no-audit --no-fund)
	echo
fi

echo "==> vsce package: $NAME $VERSION"
(cd "$VSCODE" && npx --no-install vsce package --no-dependencies -o "$OUT")

if [ ! -f "$VSIX" ]; then
	echo "FAILED: vsce reported success but $VSIX does not exist" >&2
	exit 1
fi
echo
echo "✅ $VSIX ($(wc -c <"$VSIX" | tr -d ' ') bytes, compiler from playwright-core $(cat "$VSCODE/compiler/VERSION"))"
echo "   install: code --install-extension \"$VSIX\"   (or codium)"
