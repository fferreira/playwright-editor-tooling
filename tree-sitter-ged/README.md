# tree-sitter-ged

[Tree-sitter](https://tree-sitter.github.io/) grammar for the **GED** language — a
term-rewriting language used in the
[Playwright project](https://github.com/playwright-project).

Provides syntax highlighting and basic indentation support for **Helix** and **Emacs**.

---

## Repository layout

```
crates/tree-sitter-ged/
  grammar.js                 # grammar source (edit this)
  tree-sitter.json           # grammar metadata
  Cargo.toml                 # Rust binding crate (standalone, not a workspace member)
  bindings/rust/lib.rs       # LANGUAGE const + Rust smoke test
  bindings/rust/build.rs     # cc-compiles src/parser.c
  queries/
    highlights.scm           # syntax highlighting captures
    indents.scm              # indentation rules
    injections.scm           # language injection (placeholder)
  src/parser.c               # GENERATED — commit, do not edit by hand
  src/grammar.json           # GENERATED
  src/node-types.json        # GENERATED
  editors/
    ged-ts-mode.el           # Emacs 29+ major mode
  scripts/
    generate.sh              # regenerates src/ from grammar.js
    install-helix.sh         # wires grammar into ~/.config/helix/
    install-emacs.sh         # compiles shared lib + installs ged-ts-mode.el
  test/corpus/basics.txt     # tree-sitter corpus tests
```

---

## Building the grammar

The generated `src/parser.c` is committed, so you normally **do not need to rebuild**.
Rebuild only when you change `grammar.js`:

```sh
# Prerequisites: Node.js + tree-sitter CLI
npm install -g tree-sitter-cli

cd crates/tree-sitter-ged
./scripts/generate.sh   # runs tree-sitter generate
```

### Running corpus tests

```sh
cd crates/tree-sitter-ged
tree-sitter test
```

All 31 test cases in `test/corpus/basics.txt` should pass.

### Running Rust binding tests

```sh
cd crates/tree-sitter-ged
cargo test
```

---

## Helix

### Install

```sh
cd crates/tree-sitter-ged
./scripts/install-helix.sh
```

The script:

1. Appends a guarded block (idempotent — safe to run again) to
   `~/.config/helix/languages.toml` that declares the `ged` language and points the
   grammar source at this directory.
2. Copies `queries/*.scm` to `~/.config/helix/runtime/queries/ged/`.
3. Runs `hx --grammar build` to compile the grammar (if `hx` is on your `PATH`).

Verify the installation:

```sh
hx --health ged
```

Then open any `.ged` file in Helix — syntax highlighting should be active.

### Manual config

Add the following to `~/.config/helix/languages.toml`, adjusting the path:

```toml
[[language]]
name = "ged"
scope = "source.ged"
file-types = ["ged"]
comment-token = "//"
indent = { tab-width = 4, unit = "    " }

[[grammar]]
name = "ged"
source = { path = "/absolute/path/to/crates/tree-sitter-ged" }
```

Then copy `queries/*.scm` to `~/.config/helix/runtime/queries/ged/` and run
`hx --grammar build`.

---

## Emacs

Requires **Emacs 29+** built with tree-sitter support (`--with-tree-sitter`).

### Install

```sh
cd crates/tree-sitter-ged
./scripts/install-emacs.sh
```

The script:

1. Compiles `src/parser.c` into a shared library
   (`libtree-sitter-ged.dylib` on macOS, `.so` on Linux) and installs it into
   `~/.emacs.d/tree-sitter/` (where Emacs looks for grammars by default).
2. Copies `editors/ged-ts-mode.el` to `~/.emacs.d/lisp/`.
3. Appends a guarded block (idempotent) to `~/.emacs.d/init.el`:
   ```elisp
   (add-to-list 'load-path "~/.emacs.d/lisp/")
   (require 'ged-ts-mode)
   ```

Restart Emacs and open any `.ged` file — `ged-ts-mode` activates automatically.

### Verify in Emacs

```elisp
(treesit-available-p)          ; => t
(treesit-language-available-p 'ged)  ; => t  (after ged-ts-mode loads)
```

Or `M-x ged-ts-mode` in any `.ged` buffer.

### Manual installation

If you prefer not to run the script:

```sh
# 1. Compile the shared library
cc -shared -fPIC \
   -o ~/.emacs.d/tree-sitter/libtree-sitter-ged.dylib \
   -I src \
   src/parser.c

# 2. Copy the Emacs mode
cp editors/ged-ts-mode.el ~/.emacs.d/lisp/
```

Then add to your `init.el`:

```elisp
(add-to-list 'load-path "~/.emacs.d/lisp/")
(require 'ged-ts-mode)
```

---

## GED language quick reference

```ged
// Line comment
/- block comment -/

// Fact: assert term(s) into the world
+[fact[A, B], counter[0]]

// Named rule with one body
rule increment {
    counter[N] ==> counter[N + 1]
}

// Anonymous rule with multiple bodies (tried in order)
rule {
    base[0] ==> done
} {
    step[N], N > 0 ==> step[N - 1]
}

// Type signature block
{{
    counter : type
    counter : number -> counter
}}
```

See `crates/ged/examples/` for larger examples.

---

## Licence

MIT
