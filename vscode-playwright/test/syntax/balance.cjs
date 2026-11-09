// Every .play that playwright-core ships tokenizes to the end with no region
// left open.
//
// The assertion files beside this one pin shapes, a line at a time. What they
// cannot see is a region that opens and never closes: a `<<` whose `>>` the
// grammar misses, a string that runs past its quote, a `{{` read as the wrong
// kind of block. Any of those turns the rest of a real story one colour, and
// it is exactly the failure a hand-picked example does not have. core's games
// and corpus are sixty-odd stories written for the language rather than for
// this grammar, so they are the check.
//
// Usage: node test/syntax/balance.cjs <playwright-core checkout>

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const vsctm = require("vscode-textmate");
const oniguruma = require("vscode-oniguruma");

const GRAMMAR = path.join(__dirname, "..", "..", "syntaxes", "playwright.tmLanguage.json");

async function main() {
	const core = process.argv[2];
	if (!core) {
		console.error("usage: balance.cjs <playwright-core checkout>");
		process.exit(2);
	}
	const wasm = fs.readFileSync(require.resolve("vscode-oniguruma/release/onig.wasm"));
	await oniguruma.loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
	const registry = new vsctm.Registry({
		onigLib: Promise.resolve({
			createOnigScanner: (sources) => new oniguruma.OnigScanner(sources),
			createOnigString: (s) => new oniguruma.OnigString(s),
		}),
		loadGrammar: async () => vsctm.parseRawGrammar(fs.readFileSync(GRAMMAR, "utf8"), GRAMMAR),
	});
	const grammar = await registry.loadGrammar("source.playwright");

	const files = execFileSync("git", ["-C", core, "ls-files", "*.play"], { encoding: "utf8" })
		.split("\n")
		.filter(Boolean)
		.map((f) => path.join(core, f))
		.filter((f) => !fs.lstatSync(f).isSymbolicLink());

	// A depth of 1 is the grammar's root frame and nothing else. The stack is
	// never `INITIAL` again after the first line, which is the empty sentinel
	// before the root is pushed, so that is not the comparison.
	const failures = [];
	for (const file of files) {
		let stack = vsctm.INITIAL;
		let opened = null;
		const lines = fs.readFileSync(file, "utf8").split("\n");
		lines.forEach((line, i) => {
			const wasClosed = stack.depth <= 1;
			stack = grammar.tokenizeLine(line, stack).ruleStack;
			if (wasClosed && stack.depth > 1) opened = i + 1;
		});
		if (stack.depth > 1) failures.push(`${path.relative(core, file)}: a region opened on line ${opened} is still open at the end`);
	}

	if (failures.length > 0) {
		for (const f of failures) console.error(`  ${f}`);
		console.error(`FAILED: balance — ${failures.length} of ${files.length} .play files end inside a region`);
		process.exit(1);
	}
	console.log(`✅ balance: all ${files.length} of playwright-core's .play files end with no region open`);
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
