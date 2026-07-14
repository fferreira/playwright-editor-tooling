; GED language highlights for tree-sitter
; Compatible with Helix editor capture names.

; ── Keywords ────────────────────────────────────────────────────────────────
"rule" @keyword
"type" @keyword

; ── Rule and function names ─────────────────────────────────────────────────
; Rule names come first so they win over the generic @constant below.
(rule_construct name: (symbol) @function)
(application    head: (symbol) @function)
(special_application head: (special) @function.builtin)
(special) @function.builtin

; ── Variables ────────────────────────────────────────────────────────────────
(variable) @variable

; ── Constants (bare symbol atoms used as terms or type constructors) ─────────
(type_constructor (symbol) @type)
(symbol) @constant

; ── Types ───────────────────────────────────────────────────────────────────
(base_type) @type.builtin
(any_type)  @type
(seq_type "*" @operator)

; ── Literals ────────────────────────────────────────────────────────────────
(number) @number

; Strings are atomic tokens (no inner nodes); the entire string is @string.
; For {var} interpolation highlighting inside strings, an external scanner
; would be needed to decompose strings into inner nodes.
(string) @string

; ── Operators ───────────────────────────────────────────────────────────────
(rule_arrow) @operator

(cmp_guard  operator: _ @operator)
(neg_guard  operator: _ @operator)
(binary_expression operator: _ @operator)
(unary_expression  operator: _ @operator)

[
  "="
  "<>"
  "->"
  "+"
] @operator

; ── Guard constants ──────────────────────────────────────────────────────────
(true_guard)  @constant.builtin
(false_guard) @constant.builtin

; ── Punctuation ─────────────────────────────────────────────────────────────
[
  "["  "]"
  "("  ")"
  "{"  "}"
  "{{" "}}"
] @punctuation.bracket

[
  ","
  ":"
  "::"
] @punctuation.delimiter

; ── Comments ─────────────────────────────────────────────────────────────────
(line_comment)  @comment
(block_comment) @comment
