# tree-sitter-playwright-core

[Tree-sitter](https://tree-sitter.github.io/) grammar for the **CORE** language — a
term-rewriting language used in the
[Playwright project](https://github.com/fferreira/playwright).

Provides syntax highlighting and basic indentation support for **Helix** and **Emacs**.

---

> **Known gap: the `story { … }` section.** The core language gained one when the
> story machine joined the IR — `story { moment L kind -> N { item { … } } }`,
> what `playc --compile` now writes and what `doc/core.md` specifies. This
> grammar predates it and does not parse it, so a storied `.core` highlights as
> far as the section and then stops making sense.
>
> It is a follow-up rather than a blocker, and deliberately so: this crate is
> outside the workspace, publish-shaped and on its own cadence, and nothing in
> the repository's gates reads it. Adding the section means five keywords
> (`story`, `moment`, `prompt`, `choice`, `item` — each already re-admitted as an
> ordinary symbol by the real grammar, which this one must match), three tokens
> (`=>`, `+=`, `-=`), and highlight captures for the new nodes.

> **Known gap: three grammar changes it predates.** The real grammar moved under
> it when the printer became a bijection (`to_review.md` R58, R68), and each
> change is invisible to a highlighter until it is not:
>
> - **A nested sequence is parenthesised**, `:(:a:b:):c:`, where the printer used
>   to pad with a space. `( term )` is an ordinary primary, so this parses here
>   already — but the padded form no longer appears and any test fixture spelling
>   it that way is stale.
> - **A numeric literal spans the whole signed range.** The real lexer reads
>   `digit+` and the *grammar* applies the sign before converting, so
>   `-9223372036854775808` is a literal. `number: /\d+/` here matches the digits
>   the same way, so nothing breaks; what is stale is any comment claiming the
>   magnitude has no spelling.
> - **The string lexer decodes only its own escapes.** `\"`, `\n`, `\r` and
>   `\t` belong to the quoted-literal layer; `\\`, `\{` and `\}` belong to the
>   template layer underneath and are passed through verbatim. `/\\./` here
>   accepts all of them as one token, which is right for highlighting — but the
>   comment above it lists them as one flat set, and the two layers are the thing
>   worth saying.
>
> Like the `story` gap, a follow-up rather than a blocker, for the same reason:
> nothing in the repository's gates reads this grammar.

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

All 31 test cases in `test/corpus/basics.txt` should pass.

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

### Manual config

Add the following to `~/.config/helix/languages.toml`, adjusting the path:

```toml
[[language]]
name = "playwright_core"
scope = "source.playwright-core"
file-types = ["playwright_core"]
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
    step[N], N > 0 ==> step[N - 1]
}

// Type signature block
{{
    counter : type
    counter : number -> counter
}}
```

See `playwright_core/test/corpus/` for larger examples.

---

## Licence

MIT
