// What the compiler says about a `.play`, as positions an editor can mark.
//
// Pure functions over the shapes playc-web returns, so the unit tests can check
// them in node. extension.js turns the result into `vscode.Diagnostic`s; this
// module never sees VS Code.
//
// Three things about positions are easy to get quietly wrong.
//
// **Columns are bytes.** playc reports a 1-based line and column, and the
// column counts UTF-8 bytes, as OCaml's lexer does. VS Code counts UTF-16 code
// units. They agree on ASCII and drift apart on the first `é` or `—` before the
// error, and a story's prose is exactly where those are. `utf16Column` converts,
// and a byte column that lands inside a character snaps back to its start.
//
// **A `whole_line` detail has no column worth quoting.** It reached the `.play`
// through a `#line` directive in the generated core, which names a line and not
// a column (core's `to_review.md` R30, R61), so the column belongs to text the
// author never saw. Those are marked as the whole line, as the browser IDE
// marks them.
//
// **Some complaints have no position at all**: a jump to a label no moment
// defines is about the story, not a character. Those come back with `line:
// null`, and the caller decides where to show them.

"use strict";

const { compileOptions, messagesOf } = require("./compiler");

/// The UTF-16 offset of 0-based byte column `byteColumn` in `lineText`.
function utf16Column(lineText, byteColumn) {
	let bytes = 0;
	let units = 0;
	for (const ch of lineText) {
		const cp = ch.codePointAt(0);
		const width = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
		if (bytes + width > byteColumn) break;
		bytes += width;
		units += ch.length;
	}
	return units;
}

/// One diagnostic from a detail playc-web returned, or from a bare message when
/// the detail is `null`.
///
/// `line` and `character` are 0-based, in VS Code's coordinates; `wholeLine`
/// asks for the whole line to be marked; `line: null` means there is no
/// position.
function fromDetail(lines, detail, severity, fallback) {
	if (!detail) return { severity, message: fallback, line: null, character: 0, wholeLine: false };
	const line = Math.max(0, detail.line - 1);
	const text = lines[Math.min(line, lines.length - 1)] ?? "";
	return {
		severity,
		message: detail.message,
		line,
		character: detail.whole_line ? 0 : utf16Column(text, Math.max(0, detail.column - 1)),
		wholeLine: Boolean(detail.whole_line),
	};
}

/// Every diagnostic for `source`: the warnings, then either the validation
/// failure or, if it validates, whatever compiling it reports.
///
/// Two calls because they see different things. `validate` is the editor's
/// check — parse, the story's own rules, and the warnings, which only it
/// returns — and never throws. It stops short of the generated core, so a type
/// error is invisible to it; the browser IDE shows those only when Play is
/// pressed. `compile` goes the whole way, type checker included, and is cheap
/// enough to run on a pause in typing, so here they appear as you write.
function checkSource(api, source, settings = {}) {
	const lines = source.split("\n");
	const result = api.validate(source);
	const out = (result.warnings ?? []).map((message, i) =>
		fromDetail(lines, result.warning_details?.[i], "warning", message),
	);
	if (!result.success) {
		out.push(fromDetail(lines, result.error_details, "error", result.error));
		return out;
	}
	try {
		api.compile(source, compileOptions(settings));
	} catch (e) {
		out.push(...compileFailure(lines, e));
	}
	return out;
}

/// The diagnostics for a thrown compile error: one per message, positioned by
/// the `details` array, which is aligned with `errors` index for index.
function compileFailure(lines, e) {
	const details = e && Array.isArray(e.details) ? e.details : [];
	return messagesOf(e).map((message, i) => fromDetail(lines, details[i], "error", message));
}

module.exports = { checkSource, compileFailure, utf16Column };
