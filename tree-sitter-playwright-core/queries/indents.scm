; Core Playwright (.core) indentation rules for tree-sitter / Helix
;
; Helix uses indent.scm (note singular) but tree-sitter test uses indents.scm.
; Provide this file as indents.scm; the install script symlinks/copies as needed.

; Indent one level inside rule bodies
(rule_body "{" @indent)
(rule_body "}" @outdent)

; Indent one level inside signature blocks
(signature_block "{{" @indent)
(signature_block "}}" @outdent)

; Indent one level inside the story section, each moment, and each item
(story_section   "{" @indent "}" @outdent)
(story_moment    "{" @indent "}" @outdent)
(story_item      "{" @indent "}" @outdent)
(story_encounter "{" @indent "}" @outdent)
(extern_declaration "{" @indent "}" @outdent)

; Indent inside bracketed term lists (applications and facts)
(application    "[" @indent "]" @outdent)
(fact           "[" @indent "]" @outdent)
(same_guard     "[" @indent "]" @outdent)
(diff_guard     "[" @indent "]" @outdent)
(cmp_guard      "[" @indent "]" @outdent)
(host_call      "[" @indent "]" @outdent)
(provide_clause "[" @indent "]" @outdent)
(consume_clause "[" @indent "]" @outdent)
