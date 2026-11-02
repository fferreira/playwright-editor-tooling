;;; playwright-core-ts-mode.el --- Major mode for the CORE language using tree-sitter -*- lexical-binding: t; -*-

;; Author: Francisco Ferreira
;; Version: 0.1.0
;; Package-Requires: ((emacs "29.1"))
;; Keywords: languages, tree-sitter, playwright_core
;; URL: https://github.com/fferreira/playwright

;;; Commentary:

;; A major mode for the CORE language (a term-rewriting language used by the
;; Playwright project) based on Emacs 29+ built-in tree-sitter support.
;;
;; Prerequisites
;; -------------
;; 1. Emacs 29+ built with tree-sitter support (`--with-tree-sitter`).
;; 2. The compiled shared library `libtree-sitter-playwright-core.{so,dylib}` must be in
;;    `treesit-extra-load-path` or `~/.emacs.d/tree-sitter/`.
;;
;; The `install-emacs.sh` script in the parent `scripts/` directory compiles
;; the shared library from `src/parser.c` and copies this file to
;; `~/.emacs.d/lisp/`, adding the necessary `require` to your init file.
;;
;; Manual installation
;; -------------------
;; Add to your init.el:
;;
;;   (add-to-list 'load-path "~/.emacs.d/lisp/")
;;   (require 'playwright-core-ts-mode)
;;
;; Then open any `.core` file.

;;; Code:

(require 'treesit)

(defgroup playwright_core-ts nil
  "CORE language support using tree-sitter."
  :group 'languages
  :prefix "playwright_core-ts-")

(defcustom playwright_core-ts-indent-offset 4
  "Number of spaces for each indentation level in CORE files."
  :type 'integer
  :group 'playwright_core-ts)

;;; Font-lock ----------------------------------------------------------------

(defvar playwright_core-ts--font-lock-rules
  (treesit-font-lock-rules
   :language 'playwright_core
   :feature 'comment
   '((line_comment) @font-lock-comment-face
     (block_comment) @font-lock-comment-face)

   :language 'playwright_core
   :feature 'keyword
   '("rule" @font-lock-keyword-face
     "type" @font-lock-keyword-face
     "extern" @font-lock-keyword-face)

   :language 'playwright_core
   :feature 'string
   '((string) @font-lock-string-face)

   :language 'playwright_core
   :feature 'number
   '((number) @font-lock-number-face)

   :language 'playwright_core
   :feature 'type
   '((base_type) @font-lock-type-face
     (any_type)  @font-lock-type-face
     (seq_type "*" @font-lock-operator-face)
     (type_constructor (symbol) @font-lock-type-face))

   :language 'playwright_core
   :feature 'builtin
   '((true_guard)  @font-lock-constant-face
     (false_guard) @font-lock-constant-face
     (special)      @font-lock-builtin-face
     (special_application head: (special) @font-lock-builtin-face))

   :language 'playwright_core
   :feature 'function
   '((rule_construct name: (symbol) @font-lock-function-name-face)
     (application    head: (symbol) @font-lock-function-name-face))

   :language 'playwright_core
   :feature 'variable
   '((variable) @font-lock-variable-use-face)

   :language 'playwright_core
   :feature 'constant
   ;; Bare symbols used as atoms (after more-specific patterns above)
   '((symbol) @font-lock-constant-face)

   :language 'playwright_core
   :feature 'operator
   '((rule_arrow) @font-lock-operator-face
     (neg_guard operator: _ @font-lock-operator-face)
     (keep_guard operator: _ @font-lock-operator-face)
     (cmp_guard operator: _ @font-lock-operator-face)
     (binary_expression operator: _ @font-lock-operator-face)
     (unary_expression  operator: _ @font-lock-operator-face)
     ["=" "<>" "->" "+"] @font-lock-operator-face))

  "Tree-sitter font-lock rules for `playwright-core-ts-mode'.")

;;; Indentation --------------------------------------------------------------

(defvar playwright_core-ts--indent-rules
  `((playwright_core
     ;; First child: no extra indent relative to parent
     ((node-is "rule_body") parent-bol 0)
     ((node-is "signature_item") parent-bol playwright_core-ts-indent-offset)
     ;; Body contents: indent inside { }
     ((parent-is "rule_body") parent-bol playwright_core-ts-indent-offset)
     ;; Closing braces back to parent
     ((node-is "}") parent-bol 0)
     ((node-is "}}") parent-bol 0)
     ;; Signature block contents
     ((parent-is "signature_block") parent-bol playwright_core-ts-indent-offset)
     ;; Default: keep at column 0
     (no-node parent-bol 0)))
  "Tree-sitter indentation rules for `playwright-core-ts-mode'.")

;;; Mode definition ----------------------------------------------------------

;;;###autoload
(define-derived-mode playwright-core-ts-mode prog-mode "Core"
  "Major mode for editing CORE files, using tree-sitter for parsing.

CORE is a term-rewriting language used in the Playwright project.
Syntax highlighting and basic indentation are provided via tree-sitter."
  :syntax-table (make-syntax-table prog-mode-syntax-table)

  (unless (treesit-ready-p 'playwright_core)
    (error "Tree-sitter for CORE not available; run scripts/install-emacs.sh"))

  (setq-local treesit-font-lock-settings playwright_core-ts--font-lock-rules)
  (setq-local treesit-font-lock-feature-list
              '((comment keyword)
                (string number type builtin)
                (function variable constant operator)))

  (setq-local treesit-simple-indent-rules playwright_core-ts--indent-rules)

  (setq-local comment-start "// ")
  (setq-local comment-end "")
  (setq-local comment-start-skip "//+\\s-*")

  (treesit-parser-create 'playwright_core)
  (treesit-major-mode-setup))

;;;###autoload
(add-to-list 'auto-mode-alist '("\\.playwright_core\\'" . playwright-core-ts-mode))

(provide 'playwright-core-ts-mode)
;;; playwright-core-ts-mode.el ends here
