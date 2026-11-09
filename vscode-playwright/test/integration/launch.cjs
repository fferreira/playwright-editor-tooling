// Run suite.cjs inside a real VS Code (or VSCodium), with this extension loaded
// from source and a scratch copy of fixtures/ as the workspace.
//
// The unit tests drive src/ in node. What only a real editor can show is the
// wiring in extension.js: that the language is registered, that marks appear
// and follow edits, that the commands write what they say, and that the
// settings change what they say. This opens a window for a few seconds, which
// is why ../../check.sh runs it only when VSCODE_TEST is set.
//
// It uses an installed editor rather than downloading one, so it finds:
//
//   $VSCODE_BIN, the editor's executable itself (not the `code` shell script,
//   which hands off to a running instance and returns at once); else
//   the usual install locations of VS Code and VSCodium on macOS and Linux.
//
// Given a .vsix, it unpacks it and loads *that* instead of the source tree:
//
//   node test/integration/launch.cjs                  the extension as it is here
//   node test/integration/launch.cjs <file>.vsix      the extension as it ships
//
// The second is what ../../check.sh runs, because a file the package leaves out
// is a failure only the packaged copy can show.
//
// Exit 0 on success, 1 on failure, and 77, the conventional "skipped", when
// there is no editor to run in.

"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, execFileSync } = require("node:child_process");

const SOURCE = path.join(__dirname, "..", "..");
const TIMEOUT_MS = 180_000;

const CANDIDATES = [
	"/Applications/Visual Studio Code.app/Contents/MacOS/Code",
	"/Applications/Visual Studio Code.app/Contents/MacOS/Electron",
	"/Applications/VSCodium.app/Contents/MacOS/VSCodium",
	"/Applications/VSCodium.app/Contents/MacOS/Electron",
	"/usr/share/code/code",
	"/usr/share/codium/codium",
];

function editor() {
	if (process.env.VSCODE_BIN) return process.env.VSCODE_BIN;
	return CANDIDATES.find((c) => fs.existsSync(c)) ?? null;
}

function main() {
	const bin = editor();
	if (!bin) {
		console.log("SKIP: integration — no VS Code or VSCodium found; set VSCODE_BIN to its executable");
		process.exit(77);
	}
	const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "vscode-playwright-test-"));
	let extension = SOURCE;
	const vsix = process.argv[2];
	if (vsix) {
		// A .vsix is a zip with the extension under extension/.
		execFileSync("unzip", ["-q", path.resolve(vsix), "-d", path.join(scratch, "vsix")]);
		extension = path.join(scratch, "vsix", "extension");
	}
	if (!fs.existsSync(path.join(extension, "compiler", "playc_web.js"))) {
		console.error(`FAILED: integration — ${extension} has no compiler/; run build.sh first`);
		process.exit(1);
	}
	const workspace = path.join(scratch, "workspace");
	fs.cpSync(path.join(__dirname, "fixtures"), workspace, { recursive: true });

	const args = [
		`--extensionDevelopmentPath=${extension}`,
		`--extensionTestsPath=${path.join(__dirname, "suite.cjs")}`,
		`--user-data-dir=${path.join(scratch, "user")}`,
		`--extensions-dir=${path.join(scratch, "extensions")}`,
		"--disable-extensions",
		"--disable-workspace-trust",
		"--skip-welcome",
		"--skip-release-notes",
		"--disable-gpu",
		"--new-window",
		workspace,
	];
	console.log(`==> ${path.basename(bin)}: the extension from ${vsix ? path.basename(vsix) : extension}`);

	// Set when run from a terminal inside VS Code, and it turns the editor into
	// a plain node process.
	const env = { ...process.env };
	delete env.ELECTRON_RUN_AS_NODE;

	const child = spawn(bin, args, { env, stdio: "inherit" });
	const timer = setTimeout(() => {
		console.error(`FAILED: integration — no result within ${TIMEOUT_MS / 1000}s`);
		child.kill("SIGKILL");
	}, TIMEOUT_MS);
	child.on("exit", (code, signal) => {
		clearTimeout(timer);
		fs.rmSync(scratch, { recursive: true, force: true });
		if (code === 0) {
			console.log("✅ integration: the extension works inside the editor");
			process.exit(0);
		}
		console.error(`FAILED: integration — the editor exited with ${signal ?? `code ${code}`}`);
		process.exit(1);
	});
}

main();
