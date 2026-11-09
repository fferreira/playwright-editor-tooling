# Playwright editor tooling

Editor support for [Playwright](https://github.com/fferreira/playwright), a
language for interactive fiction. This repository is **not** an implementation
of anything. The language, its grammar and its compilers live in
[**playwright-core**](https://github.com/fferreira/playwright-core), and
everything here follows them.

| Path | What it is |
|---|---|
| `tree-sitter-playwright-core/` | A tree-sitter grammar for the `.core` IR, with highlight and indent queries, an Emacs 29+ major mode, and install scripts for Helix and Emacs. See its [README](tree-sitter-playwright-core/README.md). |

The `.play` source language has no grammar here. Its editor is the browser
IDE, in the [playwright](https://github.com/fferreira/playwright) repository.

## Checking it

```sh
git clone https://github.com/fferreira/playwright-editor-tooling.git
cd playwright-editor-tooling
./check.sh
```

This runs the grammar's corpus tests (`tree-sitter test`) and its Rust binding
test (`cargo test`). If a playwright-core checkout is available, it also parses
every `.core` file core ships. It looks for one at `$CORE_DIR`, then `../core`,
then `../playwright-core`; with none, that last step prints `SKIP` and says so.
You need the tree-sitter CLI (`npm install -g tree-sitter-cli`) and a Rust
toolchain.

## How it is used

The playwright repository takes this one as a git submodule at
`editor-tooling/`, beside playwright-core at `core/`. A playwright checkout
made with `--recurse-submodules` therefore has the grammar at
`editor-tooling/tree-sitter-playwright-core/`, and `./check.sh` here finds core
at `../core` without being told.

Keeping the grammar in step with core is a manual job. core's
`play/lib/grammar.mly` and `lexer.mll` are the source of truth. When they
change, run `./check.sh` against the new core and add a corpus test for the new
shape.

## Licence

MIT. See `LICENSE`.
