/**
 * @file Tree-sitter grammar for Core Playwright, the `.core` IR
 * @see play/lib/grammar.mly — the authoritative grammar (source of truth)
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

module.exports = grammar({
  name: 'playwright_core',

  // 'rule' is a keyword; 'type', 'number', 'string' are keywords inside
  // signature blocks.  Declaring the word token enables keyword extraction:
  // these strings won't match as plain symbols at positions where the keyword
  // token is valid.
  word: $ => $.symbol,

  extras: $ => [
    /\s/,
    $.line_comment,
    $.block_comment,
  ],

  // A closing ':' and an element-separating ':' are the same token, so at the
  // ':' in `:a: - 1` the parser cannot yet tell a finished list followed by a
  // subtraction from a list whose next element is the negative number `-1`.
  // One token of lookahead is not enough; let the GLR parser carry both stacks
  // until the ']' (or the missing one) decides it.
  conflicts: $ => [
    [$.non_empty_list, $.split_list],
    [$.non_empty_list],
  ],

  rules: {
    // ── Entry point ─────────────────────────────────────────────────────────
    program: $ => repeat(choice(
      $.signature_block,
      $.rule_construct,
      $.fact,
    )),

    // ── Facts  +[term, ...]  ────────────────────────────────────────────────
    fact: $ => seq(
      '+',
      '[',
      optional($.term_list),
      ']',
    ),

    term_list: $ => seq(
      $.term,
      repeat(seq(',', $.term)),
    ),

    // ── Type signatures  {{ ... }}  ─────────────────────────────────────────
    signature_block: $ => seq(
      '{{',
      repeat($.signature_item),
      '}}',
    ),

    signature_item: $ => choice(
      $.type_declaration,
      $.constructor_signature,
    ),

    // name : type
    type_declaration: $ => seq(
      field('name', $.symbol),
      ':',
      'type',
    ),

    // name : type_expr
    constructor_signature: $ => seq(
      field('name', $.symbol),
      ':',
      $.type_expr,
    ),

    // Flat: a -> b -> c  (right-associative by construction via repeat)
    type_expr: $ => seq(
      $._atomic_type,
      repeat(seq('->', $._atomic_type)),
    ),

    _atomic_type: $ => choice(
      $.seq_type,
      $._simple_type,
    ),

    // A postfix '*' on a simple type: `fruit *` is a sequence of fruits, and
    // `? *` a sequence of anything.
    seq_type: $ => seq($._simple_type, '*'),

    _simple_type: $ => choice(
      $.base_type,
      $.any_type,
      $.type_constructor,
      seq('(', $.type_expr, ')'),
    ),

    base_type: _ => choice('number', 'string'),
    any_type: _ => '?',
    type_constructor: $ => $.symbol,

    // ── Rules  rule [name] { guards ==> terms } ...  ────────────────────────
    rule_construct: $ => seq(
      'rule',
      optional(field('name', $.symbol)),
      repeat1($.rule_body),
    ),

    rule_body: $ => seq(
      '{',
      $.guard,
      repeat(seq(',', $.guard)),
      $.rule_arrow,
      optional($.term_list),
      '}',
    ),

    rule_arrow: _ => choice('==>', '⟹'),

    // ── Guards ──────────────────────────────────────────────────────────────
    //
    // Ordering in choice() matters for tree-sitter conflict resolution.
    // Specific multi-char tokens (>=, <=, ==, <>) are listed before their
    // single-char prefixes (>, <, =).  The lexer does longest-match so this
    // is mostly belt-and-suspenders, but explicit ordering aids readability.

    guard: $ => choice(
      $.cmp_guard,    // >[..], <[..], >=[..], <=[..], ==[..]
      $.same_guard,   // =[..]
      $.diff_guard,   // <>[..]
      $.true_guard,   // (+)
      $.false_guard,  // (-)
      $.neg_guard,    // ~ term  or  ¬ term
      $.pos_guard,    // term  (positive / consuming guard)
    ),

    // Comparison guards: >=, <=, ==, >, <  followed by [term, term]
    cmp_guard: $ => seq(
      field('operator', choice('>=', '<=', '==', '>', '<')),
      '[',
      field('left', $.term),
      ',',
      field('right', $.term),
      ']',
    ),

    // Structural equality:  =[a, b]
    same_guard: $ => seq(
      '=',
      '[',
      field('left', $.term),
      ',',
      field('right', $.term),
      ']',
    ),

    // Structural difference:  <>[a, b]
    diff_guard: $ => seq(
      '<>',
      '[',
      field('left', $.term),
      ',',
      field('right', $.term),
      ']',
    ),

    // Constant truth/falsity
    true_guard: _ => '(+)',
    false_guard: _ => '(-)',

    // Negation guard:  ~term  or  ¬term
    neg_guard: $ => seq(
      field('operator', choice('~', '¬')),
      field('term', $.term),
    ),

    // Positive (consuming) guard — just a term
    pos_guard: $ => $.term,

    // ── Terms and arithmetic ────────────────────────────────────────────────
    //
    // Precedence (highest = tightest binding):
    //   4  unary minus   (right-assoc)
    //   3  ^             (right-assoc)
    //   2  * / %         (left-assoc)
    //   1  + -           (left-assoc)

    term: $ => $._expression,

    _expression: $ => choice(
      $.binary_expression,
      $.unary_expression,
      $._primary,
    ),

    binary_expression: $ => choice(
      prec.left(1, seq(
        field('left', $._expression),
        field('operator', choice('+', '-')),
        field('right', $._expression),
      )),
      prec.left(2, seq(
        field('left', $._expression),
        field('operator', choice('*', '/', '%')),
        field('right', $._expression),
      )),
      prec.right(3, seq(
        field('left', $._expression),
        field('operator', '^'),
        field('right', $._expression),
      )),
    ),

    unary_expression: $ => prec.right(4, seq(
      field('operator', '-'),
      field('operand', $._expression),
    )),

    _primary: $ => choice(
      seq('(', $._expression, ')'),
      $.list,
      $.string,
      $.number,
      $.special_application,  // must precede $.special
      $.application,          // must precede $.symbol (both start with a symbol)
      $.special,
      $.variable,
      $.symbol,
    ),

    // ── Sequence literals  ::  :a:  :a:b:  :X::REST:  ───────────────────────
    //
    // Colon-delimited, with a leading and a trailing colon.  ':' and '::' are
    // separate tokens and the lexer takes the longest match, which is what makes
    // the split form work: after the first element of `:X::REST:` the '::' is
    // lexed whole, so REST is the rest of the sequence rather than a nested list.
    // That is also why the doubled colon must be written without a space between
    // the colons, and why a nested list is spaced away from its delimiters
    // (`: :apple: :`, not `::apple::`, which would lex as two empty lists).
    list: $ => choice(
      $.empty_list,
      $.split_list,
      $.non_empty_list,
    ),

    empty_list: _ => '::',

    non_empty_list: $ => seq(
      ':',
      $.term,
      repeat(seq(':', $.term)),
      ':',
    ),

    // Leading elements, then '::', then the rest of the sequence.
    split_list: $ => seq(
      ':',
      $.term,
      repeat(seq(':', $.term)),
      '::',
      field('rest', $.term),
      ':',
    ),

    // f[arg, ...]  — application (functor symbol)
    application: $ => seq(
      field('head', $.symbol),
      '[',
      optional($.term_list),
      ']',
    ),

    // !name[arg, ...]  — special application (host-provided primitive)
    special_application: $ => seq(
      field('head', $.special),
      '[',
      optional($.term_list),
      ']',
    ),

    // ── Lexical tokens ──────────────────────────────────────────────────────

    // Atoms: start with lowercase letter
    symbol: _ => /[a-z][a-zA-Z0-9_]*/,

    // Logic variables: start with uppercase letter
    variable: _ => /[A-Z][a-zA-Z0-9_]*/,

    // Host primitives: !lowercase...
    special: _ => /![a-z][a-zA-Z0-9_]*/,

    // Non-negative integer literals; negation is handled by unary_expression
    number: _ => /\d+/,

    // Double-quoted string.  Modelled as a single atomic token so that comment-
    // like sequences inside strings (e.g. "//pattern" or "/* ... */") are never
    // mistaken for line_comment / block_comment extras.  tree-sitter's
    // token.immediate() suppresses whitespace extras but NOT named extra tokens
    // (comments), so inner-node string decomposition would mis-lex strings that
    // contain "//" or "/*".  An external C scanner would be needed for inner
    // nodes; if added later, the highlights / injections queries can be refined.
    //
    // Content rules:
    //   \<any>  — backslash escape (\\, \", \n, \t, \{, …)
    //   {Var}   — {var} interpolation template (any identifier)
    //   rest    — any char except " and \
    string: _ => token(seq(
      '"',
      repeat(choice(
        /\\./,         // escape: backslash + any char
        /[^"\\]+/,     // ordinary content (includes { } / etc.)
      )),
      '"',
    )),

    // // line comment
    line_comment: _ => token(seq('//', /.*/)),

    // /- ... -/  and  /* ... */  block comments (non-nested approximation).
    // These regexes avoid lookahead (not supported by tree-sitter's regex engine):
    //   /- content -/ : content = ([^-] | - followed by non-/)*
    //   /* content */ : content = ([^*] | * followed by non-/)*
    block_comment: _ => token(choice(
      seq('/-', /([^-]|-[^\/])*/, '-/'),
      seq('/*', /([^*]|\*[^\/])*/, '*/'),
    )),
  },
});
