# Changelog

## Unreleased

Follows playwright-core v0.6.0.

- **Floats**: `3.0`, `-2.5`, `1e5` and `3.5e10` highlight as numbers
  (`constant.numeric.float`), with the integer rule left for whole numbers.
- **`int` and `float`** are the primitive types in a `{{ … }}` block, where
  `number` was. `number` is an ordinary name since core v0.6.0, and highlights
  as one.
- The bundled compiler is built from core v0.6.0, so a story using floats,
  `!round` and `!float` compiles and is type-checked as you type.

## 0.1.0

The first version.

- `.play` highlighting, including the core inside `<< … >>` and `{{ … }}` type
  declarations.
- The compiler's errors and warnings as you type, type errors included.
- **Compile to .nisus** and **Show Disassembly**, with settings for type
  checking, stripped names, an output directory, and compiling on save.
- The compiler is playc-web, the Playwright compiler built to WebAssembly,
  shipped inside the extension.
