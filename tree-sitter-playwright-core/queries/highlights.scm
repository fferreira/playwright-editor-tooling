; Core Playwright (.core) highlights for tree-sitter.
; Compatible with Helix editor capture names. Earlier patterns win, so the
; specific captures come before the generic ones they would otherwise lose to.

; ── Keywords ────────────────────────────────────────────────────────────────
"rule" @keyword
"type" @keyword
"extern" @keyword

; The story section's words. Each is a keyword only where it shapes a story
; node; anywhere else the grammar lexes it as an ordinary (symbol).
[
  "story"
  "moment"
  "prompt"
  "choice"
  "item"
  "encounter"
] @keyword

; `#line N "file"`, which playc --compile writes by default.
(line_directive) @keyword.directive

; ── Rule and function names ─────────────────────────────────────────────────
; Rule names come first so they win over the generic @constant below.
(rule_construct name: (symbol) @function)
(application    head: (symbol) @function)
(special_application head: (special) @function.builtin)
(special) @function.builtin
; `!!fn[…]` is `!ffi["fn", …]`, so it is coloured as the special form it is.
(host_call name: (host_function) @function.builtin)

; ── Story labels ─────────────────────────────────────────────────────────────
; A moment's own label, where it goes next, an item's target, and the moment
; an encounter enters: all names of moments, so all one colour.
(story_moment    label:  (symbol) @label)
(story_moment    next:   (symbol) @label)
(story_item      target: (symbol) @label)
(story_encounter entry:  (symbol) @label)

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
(keep_guard operator: _ @operator)
(binary_expression operator: _ @operator)
(unary_expression  operator: _ @operator)

[
  "="
  "<>"
  "->"
  "+"
  "=>"
  "+="
  "-="
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
