# tree-sitter-playwright-core

[Tree-sitter](https://tree-sitter.github.io/) grammar for the **CORE** language — a
term-rewriting language used in the
[Playwright project](https://github.com/fferreira/playwright).

Provides syntax highlighting and basic indentation support for **Helix** and **Emacs**.

---

## What it covers

The whole `.core` language as `core/play/lib/grammar.mly` and `lexer.mll` have
it — the source of truth, in the playwright-core submodule — and every `.core`
file core ships parses without an error, as does everything `playc --compile`
writes for core's `.play` files. In particular:

- **The `story { … }` section**: moments, items with their `+=[…]`/`-=[…]`
  clauses and targets, and encounters. The six story words are keywords only
  where they shape a story node and ordinary symbols everywhere else, as the
  real grammar re-admits them — `choice[2]` in an encounter's trigger is a term.
- **`#line N "file"` directives**, which `playc --compile` writes by default.
  They are an extra, so one may stand between any two tokens.
- **`!!fn[a, b]` and a bare `!!fn`**, the host-call shorthand for
  `!ffi["fn", a, b]` (`host_call`). Both real parsers expand it before anything
  else sees it, and the printer writes the expansion, so it only ever appears
  in hand-written text — which is exactly the text an editor is for.

Two things are approximations, both harmless to a highlighter: block comments
do not nest here (the real lexer nests them), and a string is one token, so
`{Var}` interpolations inside it are not separate nodes (an external scanner
would be needed — see the comment in `grammar.js`).

This crate is outside the workspace and nothing in the repository's gates reads
it, so keeping it in step with core is a manual job: when core's grammar moves,
parse core's corpus with it (below) and add a corpus test for the new shape.

## Repository layout

```
crates/tree-sitter-playwright-core/
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
    playwright-core-ts-mode.el           # Emacs 29+ major mode
  scripts/
    generate.sh              # regenerates src/ from grammar.js
    install-helix.sh         # wires grammar into ~/.config/helix/
    install-emacs.sh         # compiles shared lib + installs playwright-core-ts-mode.el
  test/corpus/basics.txt     # tree-sitter corpus tests
```

---

## Building the grammar

The generated `src/parser.c` is committed, so you normally **do not need to rebuild**.
Rebuild only when you change `grammar.js`:

```sh
# Prerequisites: Node.js + tree-sitter CLI
npm install -g tree-sitter-cli

cd crates/tree-sitter-playwright-core
./scripts/generate.sh   # runs tree-sitter generate
```

### Running corpus tests

```sh
cd crates/tree-sitter-playwright-core
tree-sitter test
```

All 45 test cases in `test/corpus/basics.txt` should pass.

### Parsing core's own corpus

The corpus tests pin shapes; core's `.core` files are the check that the
grammar has not fallen behind. From this directory, with the submodule checked
out:

```sh
git -C ../../core ls-files '*.core' | sed 's|^|../../core/|' \
  | while read -r f; do [ -L "$f" ] || echo "$f"; done > /tmp/core-files.txt
tree-sitter parse -p . --quiet --stat --paths /tmp/core-files.txt
```

Every file should parse (the symlinked fixtures are skipped because they point
at files already in the list).

### Running Rust binding tests

```sh
cd crates/tree-sitter-playwright-core
cargo test
```

---

## Helix

### Install

```sh
cd crates/tree-sitter-playwright-core
./scripts/install-helix.sh
```

The script:

1. Appends a guarded block (idempotent — safe to run again) to
   `~/.config/helix/languages.toml` that declares the `playwright_core` language and points the
   grammar source at this directory.
2. Copies `queries/*.scm` to `~/.config/helix/runtime/queries/playwright_core/`.
3. Runs `hx --grammar build` to compile the grammar (if `hx` is on your `PATH`).

Verify the installation:

```sh
hx --health playwright_core
```

Then open any `.core` file in Helix — syntax highlighting should be active.

The script leaves an existing block alone, and versions before this one wrote
`file-types = ["playwright_core"]`, which matches no `.core` file. If yours says
that, delete the block between the `tree-sitter-playwright-core` markers in
`languages.toml` and run the script again.

### Manual config

Add the following to `~/.config/helix/languages.toml`, adjusting the path:

```toml
[[language]]
name = "playwright_core"
scope = "source.playwright-core"
file-types = ["core"]
comment-token = "//"
indent = { tab-width = 4, unit = "    " }

[[grammar]]
name = "playwright_core"
source = { path = "/absolute/path/to/crates/tree-sitter-playwright-core" }
```

Then copy `queries/*.scm` to `~/.config/helix/runtime/queries/playwright_core/` and run
`hx --grammar build`.

---

## Emacs

Requires **Emacs 29+** built with tree-sitter support (`--with-tree-sitter`).

### Install

```sh
cd crates/tree-sitter-playwright-core
./scripts/install-emacs.sh
```

The script:

1. Compiles `src/parser.c` into a shared library
   (`libtree-sitter-playwright-core.dylib` on macOS, `.so` on Linux) and installs it into
   `~/.emacs.d/tree-sitter/` (where Emacs looks for grammars by default).
2. Copies `editors/playwright-core-ts-mode.el` to `~/.emacs.d/lisp/`.
3. Appends a guarded block (idempotent) to `~/.emacs.d/init.el`:
   ```elisp
   (add-to-list 'load-path "~/.emacs.d/lisp/")
   (require 'playwright-core-ts-mode)
   ```

Restart Emacs and open any `.core` file — `playwright-core-ts-mode` activates automatically.

### Verify in Emacs

```elisp
(treesit-available-p)          ; => t
(treesit-language-available-p 'playwright_core)  ; => t  (after playwright-core-ts-mode loads)
```

Or `M-x playwright-core-ts-mode` in any `.core` buffer.

### Manual installation

If you prefer not to run the script:

```sh
# 1. Compile the shared library
cc -shared -fPIC \
   -o ~/.emacs.d/tree-sitter/libtree-sitter-playwright-core.dylib \
   -I src \
   src/parser.c

# 2. Copy the Emacs mode
cp editors/playwright-core-ts-mode.el ~/.emacs.d/lisp/
```

Then add to your `init.el`:

```elisp
(add-to-list 'load-path "~/.emacs.d/lisp/")
(require 'playwright-core-ts-mode)
```

---

## CORE language quick reference

```playwright_core
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
    step[N], >[N, 0] ==> step[N - 1]
}

// Type signature block
{{
    counter : type
    counter : number -> counter
}}

// Facts the host owns: the story reads them and never changes them
extern { player_at[X, Y] }

// Ask the host: !!roll[6] is !ffi["roll", 6], and a bare !!clock is !ffi["clock"]
rule ask { asking ==> rolled[!!roll[6]], now[!!clock] }

// The story section, as playc --compile writes it
story {
    encounter comp_m1 { choice[2], ~seen }
    moment comp_m0 choice -> comp_end {
        item { => "Open it." +=[player[bold]] -> comp_m1 }
        item { rolled[N], >[N, 3] => "Knock first." -=[asking] }
    }
    moment comp_m1 prompt -> comp_end {
        item { choice[2], ~seen => "A detour." +=[seen] }
    }
}
```

See `test/corpus/` for larger examples.

---

## Licence

MIT
