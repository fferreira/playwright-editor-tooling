# Playwright editor tooling

Editor support for [Playwright](https://github.com/fferreira/playwright), a
language for interactive fiction. This repository is **not** an implementation
of anything. The language, its grammar and its compilers live in
[**playwright-core**](https://github.com/fferreira/playwright-core), and
everything here follows them.

| Path | What it is |
|---|---|
| `vscode-playwright/` | A VS Code extension for `.play` stories: highlighting, the compiler's errors and warnings as you type, and **Compile to .nisus**. The compiler is playc-web, core's own compiler built to WebAssembly, shipped inside the extension. See its [README](vscode-playwright/README.md). |
| `tree-sitter-playwright-core/` | A tree-sitter grammar for the `.core` IR, with highlight and indent queries, an Emacs 29+ major mode, and install scripts for Helix and Emacs. See its [README](tree-sitter-playwright-core/README.md). |
| `tools/core_dir.sh` | Where the tools here find playwright-core. |

**Two languages, two technologies.** VS Code highlights with TextMate
grammars, and Helix and Emacs with tree-sitter, so `.play` has a TextMate grammar
(`vscode-playwright/syntaxes/`) and `.core` a tree-sitter one. Neither is a
parser. Both follow core's lexers, and both are tested against every file of
their language that core ships. The browser IDE has a third highlighter, a
CodeMirror mode, in the playwright repository.

## Checking it

```sh
git clone https://github.com/fferreira/playwright-editor-tooling.git
cd playwright-editor-tooling
(cd vscode-playwright && npm ci)
./check.sh                       # everything
./check.sh grammar               # or one category: grammar, vscode
VSCODE_TEST=1 ./check.sh vscode  # and drive the packaged extension in VS Code
```

`grammar` runs the tree-sitter grammar's corpus tests, its Rust binding test,
and parses every `.core` file core ships. `vscode` runs these:
- the highlighting grammar's tests;
- the build of playc-web from core;
- the extension's unit tests against that compiler;
- `vsce package`;
- with `VSCODE_TEST` set, the packaged `.vsix` inside an installed VS Code or
  VSCodium.

Most steps need a playwright-core checkout. `tools/core_dir.sh` looks at
`$CORE_DIR`, then `../core`, then `../playwright-core`. Building the compiler
also needs dune, `wasm_of_ocaml` and binaryen. A step that can't run is listed
under `SKIPPED` at the end, with the reason.

## How it is used

The playwright repository takes this one as a git submodule at
`editor-tooling/`, beside playwright-core at `core/`. A playwright checkout
made with `--recurse-submodules` therefore has everything here, and
`./check.sh` finds core at `../core` without being told.

Keeping up with core is a manual job. When core's grammars move
(`play/lib/grammar.mly` and `lexer.mll` for `.core`,
`playc/lib/play_lexer.mll` and `play_grammar.mly` for `.play`), run
`./check.sh` against the new core. Then add a test for the new shape: a corpus
case for tree-sitter, an assertion file under `vscode-playwright/test/syntax/`
for TextMate. The extension's compiler needs no keeping up: it's rebuilt from
core every time the extension is built.

## Licence

MIT. See `LICENSE`.
