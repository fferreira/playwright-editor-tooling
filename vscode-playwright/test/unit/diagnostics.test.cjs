// What the compiler reports, at the positions an editor marks — against the
// real compiler, so a change in playc-web's shapes fails here rather than in a
// squiggle in the wrong place.

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { loadCompiler } = require("../../src/compiler");
const { checkSource, utf16Column } = require("../../src/diagnostics");
const { COMPILER, COIN, ILL_TYPED, coreDir } = require("./support.cjs");

const api = () => loadCompiler(COMPILER).then((loaded) => loaded.api);

/// The text at a diagnostic, as the editor would mark it.
const textAt = (source, d) => source.split("\n")[d.line].slice(d.character);

/// The same, read the compiler's way: its column counts bytes.
const bytesAt = (source, detailLine, detailColumn) =>
	Buffer.from(source.split("\n")[detailLine - 1]).subarray(detailColumn - 1).toString();

test("utf16Column converts a byte column to the code units VS Code counts", () => {
	assert.strictEqual(utf16Column("plain ascii", 6), 6);
	assert.strictEqual(utf16Column("Café au lait", 6), 5, "é is two bytes and one unit");
	assert.strictEqual(utf16Column("a 🎲 b", 7), 5, "a die is four bytes and two units");
	assert.strictEqual(utf16Column("—x", 3), 1, "an em dash is three bytes");
	assert.strictEqual(utf16Column("Café", 4), 3, "inside a character snaps back to its start");
	assert.strictEqual(utf16Column("ab", 99), 2, "past the end clamps to the end");
});

test("a story that compiles has nothing to report", async () => {
	assert.deepStrictEqual(checkSource(await api(), COIN), []);
});

test("a parse failure is an error at the compiler's own column", async () => {
	const source = "-> Hi\n?[a, b&] -> x\n";
	const [d] = checkSource(await api(), source);
	const detail = (await api()).validate(source).error_details;
	assert.strictEqual(d.severity, "error");
	assert.strictEqual(d.line, 1);
	assert.strictEqual(d.wholeLine, false);
	assert.match(d.message, /unexpected character '&'/);
	assert.strictEqual(d.character, detail.column - 1, "on ASCII, bytes and code units agree");
	assert.strictEqual(textAt(source, d), bytesAt(source, detail.line, detail.column));
});

test("prose with accents before an error does not move the mark", async () => {
	// The compiler's column is in bytes; Zoë's ë is two of them and one unit.
	const source = '-> Café, Zoë — and a 🎲.\n?[name["Zoë 🎲"], &] -> x\n';
	const [d] = checkSource(await api(), source);
	const detail = (await api()).validate(source).error_details;
	assert.strictEqual(d.line, 1);
	assert.strictEqual(textAt(source, d), bytesAt(source, detail.line, detail.column));
	assert.notStrictEqual(d.character, detail.column - 1, "a byte column used as-is would be wrong here");
});

test("a type error is marked as the whole line it came from", async () => {
	const diagnostics = checkSource(await api(), ILL_TYPED);
	assert.strictEqual(diagnostics.length, 1);
	const [d] = diagnostics;
	assert.strictEqual(d.severity, "error");
	assert.strictEqual(d.wholeLine, true, "the column belongs to the generated core");
	assert.strictEqual(ILL_TYPED.split("\n")[d.line], '+[f["not a number"]]');
	assert.match(d.message, /^type error: /, "the position is not repeated in the message");
});

test("type checking can be turned off", async () => {
	assert.deepStrictEqual(checkSource(await api(), ILL_TYPED, { typeCheck: false }), []);
});

test("a complaint about the story as a whole has no position", async () => {
	const [d] = checkSource(await api(), "-> Hi [-> nowhere]\n");
	assert.strictEqual(d.line, null);
	assert.strictEqual(d.message, "no moment is labelled `nowhere`");
});

test("a warning is a warning, at the rule it is about", async () => {
	const source = "<<\n+[seed]\nrule spin { $seed ==> dizzy }\n>>\n-> Hi\n";
	const [d] = checkSource(await api(), source);
	assert.strictEqual(d.severity, "warning");
	assert.strictEqual(d.line, 2);
	assert.match(d.message, /rule 'spin' only keeps/);
});

test("warnings are kept when the story also fails to compile", async () => {
	const source = "<<\n+[seed]\nrule spin { $seed ==> dizzy }\n>>\n-> Hi [-> nowhere]\n";
	const severities = checkSource(await api(), source).map((d) => d.severity);
	assert.deepStrictEqual(severities, ["warning", "error"]);
});

test("Windows line endings do not move a mark", async () => {
	const unix = "-> Hi\n?[a, b&] -> x\n";
	const [lf] = checkSource(await api(), unix);
	const [crlf] = checkSource(await api(), unix.replaceAll("\n", "\r\n"));
	assert.deepStrictEqual(crlf, lf);
});

test("every story in playwright-core's games and corpus checks clean", async (t) => {
	const core = coreDir();
	if (!core) {
		t.skip("no playwright-core checkout (tools/core_dir.sh)");
		return;
	}
	const files = execFileSync("git", ["-C", core, "ls-files", "games/*.play", "corpus/*.play"], { encoding: "utf8" })
		.split("\n")
		.filter(Boolean);
	assert.ok(files.length >= 10, `found only ${files.length} stories in ${core}`);
	const compiler = await api();
	for (const file of files) {
		const found = checkSource(compiler, fs.readFileSync(path.join(core, file), "utf8"));
		assert.deepStrictEqual(found, [], `${file} should have nothing to report`);
	}
});
