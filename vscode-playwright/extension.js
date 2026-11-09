// The extension: VS Code's API on one side, the modules in src/ on the other.
//
// This is the only file that imports `vscode`. Everything that decides
// something — what the compiler reported and where, which options a setting
// means, where a `.nisus` goes — is in src/ and tested in node; what is here is
// wiring, which test/integration/ drives inside a real VS Code.

"use strict";

const path = require("node:path");
const vscode = require("vscode");
const { loadCompiler, compileOptions, messagesOf } = require("./src/compiler");
const { checkSource } = require("./src/diagnostics");
const { nisusPath } = require("./src/paths");

const LANGUAGE = "playwright";

// Long enough that the compiler does not run on every keystroke of a word,
// short enough that a mark appears as soon as the author pauses.
const CHECK_DELAY_MS = 300;

const pending = new Map();

function activate(context) {
	const output = vscode.window.createOutputChannel("Playwright");
	const collection = vscode.languages.createDiagnosticCollection(LANGUAGE);
	context.subscriptions.push(output, collection);

	const compiler = loadCompiler(path.join(context.extensionPath, "compiler")).then(
		(loaded) => {
			output.appendLine(
				`Playwright compiler ready: playc-web from playwright-core ${loaded.version ?? "(version not recorded)"}`,
			);
			return loaded;
		},
		(e) => {
			output.appendLine(`The Playwright compiler failed to load: ${e.message}`);
			vscode.window.showErrorMessage(`Playwright: the compiler failed to load. ${e.message}`);
			throw e;
		},
	);
	// Reported once, above. Every later `await compiler` sees the rejection and
	// gives up quietly; this keeps the first one from also being "unhandled".
	compiler.catch(() => {});

	// --- marks as you type ---------------------------------------------------

	function schedule(document) {
		if (document.languageId !== LANGUAGE) return;
		const key = document.uri.toString();
		clearTimeout(pending.get(key));
		pending.set(
			key,
			setTimeout(() => {
				pending.delete(key);
				refresh(document);
			}, CHECK_DELAY_MS),
		);
	}

	async function refresh(document) {
		let loaded;
		try {
			loaded = await compiler;
		} catch {
			return;
		}
		if (document.isClosed) return;
		const found = checkSource(loaded.api, document.getText(), settingsFor(document.uri));
		collection.set(
			document.uri,
			found.map((d) => toDiagnostic(document, d)),
		);
	}

	function forget(document) {
		const key = document.uri.toString();
		clearTimeout(pending.get(key));
		pending.delete(key);
		collection.delete(document.uri);
	}

	// --- the commands --------------------------------------------------------

	/// Compile with `options`, or say why not. Returns the bytes, or `null`
	/// after reporting the failure: in a notification for a command someone ran,
	/// in the status bar for a save, which already has its marks in the editor.
	async function compileOrReport(source, options, { quiet = false } = {}) {
		let loaded;
		try {
			loaded = await compiler;
		} catch {
			return null;
		}
		try {
			return loaded.api.compile(source.text, options);
		} catch (e) {
			const messages = messagesOf(e);
			output.appendLine(`${label(source.uri)} did not compile:`);
			for (const m of messages) output.appendLine(`  ${m}`);
			if (source.document) refresh(source.document);
			const summary = messages.length > 1 ? `${messages[0]} (and ${messages.length - 1} more)` : messages[0];
			if (quiet) {
				vscode.window.setStatusBarMessage(`$(error) Playwright: ${label(source.uri)} did not compile`, 5000);
			} else {
				// Not awaited: the promise settles only when the notification is
				// dismissed, and the command should finish when the compile does.
				vscode.window
					.showErrorMessage(`Playwright: ${label(source.uri)} did not compile. ${summary}`, "Show Problems")
					.then((choice) => {
						if (choice) vscode.commands.executeCommand("workbench.actions.view.problems");
					});
			}
			return null;
		}
	}

	/// **Compile to .nisus.** Returns the URI written, or `undefined`.
	async function compileCommand(uri, { quiet = false } = {}) {
		const source = await sourceFor(uri);
		if (!source) return undefined;
		const settings = settingsFor(source.uri);
		const bytes = await compileOrReport(source, compileOptions(settings), { quiet });
		if (!bytes) return undefined;
		const target = await targetFor(source.uri, settings);
		if (!target) return undefined;
		try {
			if (target.scheme === "file") {
				await vscode.workspace.fs.createDirectory(vscode.Uri.file(path.dirname(target.fsPath)));
			}
			await vscode.workspace.fs.writeFile(target, bytes);
		} catch (e) {
			vscode.window.showErrorMessage(`Playwright: could not write ${label(target)}. ${e.message}`);
			return undefined;
		}
		const message = `Compiled ${label(source.uri)} to ${label(target)} (${bytes.length} bytes)`;
		output.appendLine(message);
		vscode.window.setStatusBarMessage(`$(check) ${message}`, 5000);
		return target;
	}

	/// **Show Disassembly**: the compiled game as text, beside the source.
	/// Returns the document opened, or `undefined`.
	async function disassembleCommand(uri) {
		const source = await sourceFor(uri);
		if (!source) return undefined;
		const settings = settingsFor(source.uri);
		const bytes = await compileOrReport(source, { format: "disasm", typeCheck: settings.typeCheck });
		if (!bytes) return undefined;
		const document = await vscode.workspace.openTextDocument({
			content: new TextDecoder().decode(bytes),
			language: "plaintext",
		});
		await vscode.window.showTextDocument(document, { viewColumn: vscode.ViewColumn.Beside, preview: true });
		return document;
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(schedule),
		vscode.workspace.onDidChangeTextDocument((e) => {
			if (e.contentChanges.length > 0) schedule(e.document);
		}),
		vscode.workspace.onDidCloseTextDocument(forget),
		vscode.workspace.onDidSaveTextDocument((document) => {
			if (document.languageId === LANGUAGE && settingsFor(document.uri).onSave) {
				compileCommand(document.uri, { quiet: true });
			}
		}),
		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration("playwright.compile")) {
				for (const document of vscode.workspace.textDocuments) schedule(document);
			}
		}),
		vscode.commands.registerCommand("playwright.compile", (uri) => compileCommand(uri)),
		vscode.commands.registerCommand("playwright.showDisassembly", (uri) => disassembleCommand(uri)),
	);

	for (const document of vscode.workspace.textDocuments) schedule(document);
}

function deactivate() {
	for (const timer of pending.values()) clearTimeout(timer);
	pending.clear();
}

// --- helpers ----------------------------------------------------------------

function settingsFor(uri) {
	const c = vscode.workspace.getConfiguration("playwright", uri);
	return {
		typeCheck: c.get("compile.typeCheck", true),
		stripNames: c.get("compile.stripNames", false),
		outputDirectory: c.get("compile.outputDirectory", ""),
		onSave: c.get("compile.onSave", false),
	};
}

/// The text to compile: the editor's when the file is open, unsaved edits and
/// all, because what the author is looking at is what they mean; the file on
/// disk otherwise, for a compile started from the explorer. `uri` is what a
/// menu passes, and `undefined` from the command palette, which means the
/// active editor.
async function sourceFor(uri) {
	const target = uri ?? vscode.window.activeTextEditor?.document.uri;
	if (!target) {
		vscode.window.showInformationMessage("Playwright: open a .play file to compile it.");
		return null;
	}
	const open = vscode.workspace.textDocuments.find((d) => d.uri.toString() === target.toString());
	if (open) return { uri: target, text: open.getText(), document: open };
	try {
		const bytes = await vscode.workspace.fs.readFile(target);
		return { uri: target, text: new TextDecoder().decode(bytes), document: null };
	} catch (e) {
		vscode.window.showErrorMessage(`Playwright: could not read ${label(target)}. ${e.message}`);
		return null;
	}
}

/// Where the `.nisus` goes: src/paths.js for a file on disk, and a save dialog
/// for anything else, an untitled buffer above all, which has nowhere to be
/// beside.
async function targetFor(uri, settings) {
	if (uri.scheme === "file") {
		const folder = vscode.workspace.getWorkspaceFolder(uri);
		return vscode.Uri.file(
			nisusPath(uri.fsPath, {
				outputDirectory: settings.outputDirectory,
				workspaceRoot: folder && folder.uri.scheme === "file" ? folder.uri.fsPath : null,
			}),
		);
	}
	return vscode.window.showSaveDialog({
		title: "Compile to .nisus",
		filters: { "Playwright game": ["nisus"] },
	});
}

function label(uri) {
	return uri.scheme === "file" ? vscode.workspace.asRelativePath(uri) : uri.toString(true);
}

function toDiagnostic(document, d) {
	let range;
	if (d.line === null) {
		range = new vscode.Range(0, 0, 0, 0);
	} else {
		const line = document.lineAt(Math.min(d.line, document.lineCount - 1));
		const at = Math.min(d.character, line.text.length);
		range = d.wholeLine ? line.range : new vscode.Range(line.lineNumber, at, line.lineNumber, at);
	}
	const severity = d.severity === "warning" ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Error;
	const diagnostic = new vscode.Diagnostic(range, d.message, severity);
	diagnostic.source = "playc";
	return diagnostic;
}

module.exports = { activate, deactivate };
