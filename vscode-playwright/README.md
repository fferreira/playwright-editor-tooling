# Playwright for VS Code

Write [Playwright](https://github.com/fferreira/playwright) interactive fiction
in VS Code. A `.play` file gets highlighting, the compiler's errors and warnings
as you type, and a command that compiles it to the `.nisus` a Playwright runtime
plays.

The compiler is the real one. It's `playc`, the same OCaml compiler as the
command line and the browser IDE, built to WebAssembly and shipped inside the
extension. Nothing else needs installing, and nothing is sent anywhere.

## What it does

- **Highlighting** for everything a `.play` holds:
  - moments, labels and jumps;
  - guards and `+=`/`-=` clauses;
  - `{Var}` interpolation;
  - encounters (`@@[ … ]@@`, `<-`);
  - the core inside `<< … >>`, meaning facts, rules, `extern`, `!rand` and `!!host` calls;
  - `{{ … }}` type declarations.
- **Errors and warnings as you type**, in the editor and in Problems:
  - parse errors at the character;
  - a jump to a label that doesn't exist;
  - a variable no guard binds;
  - a rule that keeps everything and never stops, which is a warning.
- **Type errors as you type too.** The extension compiles all the way to the
  generated core on a pause in typing. A type error therefore appears on the
  line that caused it, without running anything. It marks the whole line,
  because the compiler knows the line and not the column.
- **Playwright: Compile to .nisus** (editor title bar, context menus, command
  palette) writes `story.nisus` beside `story.play`. It compiles what's in the
  editor, unsaved edits included. From the explorer it compiles the file on disk.
- **Playwright: Show Disassembly** opens the compiled game as text, beside the
  source.

## Settings

| Setting | Default | |
|---|---|---|
| `playwright.compile.typeCheck` | `true` | Type-check against the story's `{{…}}` declarations, as you type and when compiling |
| `playwright.compile.stripNames` | `false` | Replace symbol names with numbers, as `playc --strip-names` does: smaller, and what a Playdate build ships |
| `playwright.compile.outputDirectory` | `""` | Where `.nisus` files go. Empty means beside the `.play`. A relative directory keeps each story's place in the workspace |
| `playwright.compile.onSave` | `false` | Compile every time a `.play` is saved |

In an untrusted workspace, the folder's own settings can't set
`outputDirectory` or `onSave`. That way, opening someone else's repository
can't make saving a file write files somewhere of their choosing.

## Things to know

- **Which compiler is this?** The **Playwright** output channel says which
  playwright-core version the bundled compiler was built from.
- **A few complaints have no position.** A jump to a missing label is about the
  story, not a character, and the compiler reports it without a position. These
  show at the top of the file and in Problems.
- **The mark is where the compiler says.** For an unexpected character, that's
  the position just after it.
- **`"` doesn't auto-close.** A quote in prose is usually just a quote, and
  terms inside brackets are rarer than dialogue.

## Building it

The extension lives in
[playwright-editor-tooling](https://github.com/fferreira/playwright-editor-tooling),
and its compiler comes from
[playwright-core](https://github.com/fferreira/playwright-core). `build.sh`
builds playc-web there (`dune build @playc/web/web`, which needs
`wasm_of_ocaml` and binaryen) and stages it into `compiler/`. It finds core
the way the rest of the repository does: `$CORE_DIR`, then `../core` (inside a
playwright checkout), then `../playwright-core`.

```sh
../build_vsix.sh       # vscode-playwright-<version>.vsix, dev tools and compiler included
code --install-extension vscode-playwright-0.1.0.vsix
```

Or step by step:

```sh
npm ci
npm run build          # stage the compiler
npm test               # unit tests, in node, against the real compiler
npm run test:syntax    # the highlighting grammar
npm run package        # vscode-playwright-<version>.vsix
```

`npm run test:integration` runs the extension inside an installed VS Code or
VSCodium. Set `VSCODE_BIN` to the editor's executable if it isn't in the
usual place. `../check.sh vscode` runs all of it.

## Licence

MIT.
