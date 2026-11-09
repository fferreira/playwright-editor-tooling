// The end-to-end checks, run inside the editor by launch.cjs.
//
// Each check drives the extension the way an author would — open a file, type,
// save, run a command, change a setting — and looks at what VS Code itself then
// holds: the document's language, the Problems list, the files on disk. The
// workspace is a scratch copy of fixtures/, so writing into it is fine.

"use strict";

const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");

const ID = "fferreira.vscode-playwright";
const MAGIC = Buffer.from([0xc0, 0xde, 0xda, 0x7a]);

// The extension waits 300 ms after a change before checking; this is how long
// a check that should have *found nothing* is given to find something.
const SETTLE_MS = 1500;

const root = () => vscode.workspace.workspaceFolders[0].uri;
const at = (...parts) => vscode.Uri.joinPath(root(), ...parts);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const marks = (uri) => vscode.languages.getDiagnostics(uri);

async function waitFor(what, predicate, timeout = 20_000) {
	const deadline = Date.now() + timeout;
	for (;;) {
		const value = await predicate();
		if (value) return value;
		if (Date.now() > deadline) throw new Error(`timed out waiting for ${what}`);
		await sleep(100);
	}
}

async function open(...parts) {
	const document = await vscode.workspace.openTextDocument(at(...parts));
	await vscode.window.showTextDocument(document);
	return document;
}

async function setting(name, value) {
	await vscode.workspace.getConfiguration("playwright").update(name, value, vscode.ConfigurationTarget.Workspace);
}

const checks = [];
const check = (name, fn) => checks.push({ name, fn });

check("the extension activates", async () => {
	const extension = vscode.extensions.getExtension(ID);
	assert.ok(extension, `${ID} is installed`);
	await extension.activate();
	assert.ok(extension.isActive);
	const commands = await vscode.commands.getCommands(true);
	assert.ok(commands.includes("playwright.compile"));
	assert.ok(commands.includes("playwright.showDisassembly"));
});

check("a .play is in the Playwright language", async () => {
	assert.strictEqual((await open("coin.play")).languageId, "playwright");
});

check("a parse error is marked where the compiler says", async () => {
	const document = await open("broken.play");
	const [d] = await waitFor("a mark on broken.play", () => marks(document.uri).length > 0 && marks(document.uri));
	assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Error);
	assert.strictEqual(d.source, "playc");
	assert.strictEqual(d.range.start.line, 1);
	assert.match(d.message, /unexpected character '&'/);
});

check("a story that compiles has no marks", async () => {
	const document = await open("coin.play");
	await sleep(SETTLE_MS);
	assert.deepStrictEqual(marks(document.uri), []);
});

check("a type error is marked as its whole line, as you type", async () => {
	const document = await open("typed.play");
	const [d] = await waitFor("a mark on typed.play", () => marks(document.uri).length > 0 && marks(document.uri));
	assert.match(d.message, /^type error: /);
	assert.strictEqual(d.range.start.line, 5);
	assert.strictEqual(d.range.start.character, 0);
	assert.strictEqual(d.range.end.character, document.lineAt(5).text.length);
});

check("accented prose before an error does not move the mark", async () => {
	const document = await open("accents.play");
	const [d] = await waitFor("a mark on accents.play", () => marks(document.uri).length > 0 && marks(document.uri));
	// Where the compiler means, read its way: its column counts UTF-8 bytes.
	const { loadCompiler } = require(path.join(vscode.extensions.getExtension(ID).extensionPath, "src", "compiler"));
	const { api } = await loadCompiler(path.join(vscode.extensions.getExtension(ID).extensionPath, "compiler"));
	const detail = api.validate(document.getText()).error_details;
	const line = document.lineAt(d.range.start.line).text;
	const meant = Buffer.from(line).subarray(detail.column - 1).toString();
	assert.strictEqual(line.slice(d.range.start.character), meant);
	assert.notStrictEqual(d.range.start.character, detail.column - 1);
});

check("a warning is a warning", async () => {
	const document = await open("warn.play");
	const [d] = await waitFor("a mark on warn.play", () => marks(document.uri).length > 0 && marks(document.uri));
	assert.strictEqual(d.severity, vscode.DiagnosticSeverity.Warning);
	assert.strictEqual(d.range.start.line, 2);
});

check("a complaint with no position is still in Problems", async () => {
	const document = await open("dangling.play");
	const [d] = await waitFor("a mark on dangling.play", () => marks(document.uri).length > 0 && marks(document.uri));
	assert.strictEqual(d.message, "no moment is labelled `nowhere`");
	assert.ok(d.range.start.isEqual(new vscode.Position(0, 0)));
});

check("marks follow edits", async () => {
	const document = await open("coin.play");
	const breaking = new vscode.WorkspaceEdit();
	breaking.insert(document.uri, new vscode.Position(0, 0), "?[x&] -> Oops\n");
	assert.ok(await vscode.workspace.applyEdit(breaking));
	await waitFor("the new error", () => marks(document.uri).length > 0);
	const mending = new vscode.WorkspaceEdit();
	mending.delete(document.uri, new vscode.Range(0, 0, 1, 0));
	assert.ok(await vscode.workspace.applyEdit(mending));
	await waitFor("the error to go", () => marks(document.uri).length === 0);
	await document.save();
});

check("Compile to .nisus writes beside the source", async () => {
	const target = await vscode.commands.executeCommand("playwright.compile", at("coin.play"));
	assert.strictEqual(target.fsPath, at("coin.nisus").fsPath);
	assert.deepStrictEqual(fs.readFileSync(target.fsPath).subarray(0, 4), MAGIC);
});

check("what is compiled is the editor's text, unsaved edits included", async () => {
	const document = await open("coin.play");
	const edit = new vscode.WorkspaceEdit();
	edit.insert(document.uri, new vscode.Position(0, 0), "-> An unsaved first line.\n");
	assert.ok(await vscode.workspace.applyEdit(edit));
	const target = await vscode.commands.executeCommand("playwright.compile", document.uri);
	const disasm = await vscode.commands.executeCommand("playwright.showDisassembly", document.uri);
	assert.ok(fs.existsSync(target.fsPath));
	assert.match(disasm.getText(), /An unsaved first line\./);
	await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
	await vscode.window.showTextDocument(document);
	await vscode.commands.executeCommand("workbench.action.files.revert");
});

check("a story that does not compile writes nothing", async () => {
	const target = await vscode.commands.executeCommand("playwright.compile", at("broken.play"));
	assert.strictEqual(target, undefined);
	assert.ok(!fs.existsSync(at("broken.nisus").fsPath));
});

check("Show Disassembly opens the compiled game as text", async () => {
	const document = await vscode.commands.executeCommand("playwright.showDisassembly", at("coin.play"));
	assert.ok(document.getText().startsWith("code"), "a disassembly opens with its `code` header");
	await vscode.commands.executeCommand("workbench.action.closeActiveEditor");
});

check("stripNames writes the smaller, stripped form", async () => {
	const kept = fs.statSync((await vscode.commands.executeCommand("playwright.compile", at("coin.play"))).fsPath).size;
	await setting("compile.stripNames", true);
	try {
		const target = await vscode.commands.executeCommand("playwright.compile", at("coin.play"));
		const stripped = fs.readFileSync(target.fsPath);
		assert.deepStrictEqual(stripped.subarray(0, 4), MAGIC);
		assert.ok(stripped.length < kept, `${stripped.length} < ${kept}`);
	} finally {
		await setting("compile.stripNames", undefined);
	}
});

check("an output directory keeps each story's place, for a file that is not open", async () => {
	await setting("compile.outputDirectory", "out");
	try {
		const target = await vscode.commands.executeCommand("playwright.compile", at("stories", "nested.play"));
		assert.strictEqual(target.fsPath, at("out", "stories", "nested.nisus").fsPath);
		assert.deepStrictEqual(fs.readFileSync(target.fsPath).subarray(0, 4), MAGIC);
	} finally {
		await setting("compile.outputDirectory", undefined);
	}
});

check("onSave compiles when a .play is saved", async () => {
	const nisus = at("stories", "nested.nisus").fsPath;
	fs.rmSync(nisus, { force: true });
	await setting("compile.onSave", true);
	try {
		const document = await open("stories", "nested.play");
		const edit = new vscode.WorkspaceEdit();
		edit.insert(document.uri, document.lineAt(document.lineCount - 1).range.end, "\n");
		assert.ok(await vscode.workspace.applyEdit(edit));
		await document.save();
		await waitFor("nested.nisus to be written on save", () => fs.existsSync(nisus));
	} finally {
		await setting("compile.onSave", undefined);
	}
});

check("turning type checking off clears a type error", async () => {
	const document = await open("typed.play");
	await waitFor("the type error", () => marks(document.uri).length > 0);
	await setting("compile.typeCheck", false);
	try {
		await waitFor("the type error to go", () => marks(document.uri).length === 0);
	} finally {
		await setting("compile.typeCheck", undefined);
	}
	await waitFor("the type error to come back", () => marks(document.uri).length > 0);
});

async function run() {
	const failures = [];
	for (const { name, fn } of checks) {
		try {
			await fn();
			console.log(`  ✓ ${name}`);
		} catch (e) {
			failures.push(name);
			console.log(`  ✗ ${name}\n      ${String((e && e.stack) || e).split("\n").join("\n      ")}`);
		}
	}
	if (failures.length > 0) {
		throw new Error(`${failures.length} of ${checks.length} integration checks failed`);
	}
	console.log(`  ${checks.length} integration checks passed`);
}

module.exports = { run };
