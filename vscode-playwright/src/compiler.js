// playc-web, loaded: the Playwright compiler built to WebAssembly.
//
// The same compiler as `playc` on the command line and as the browser IDE's,
// built by playwright-core (`dune build @playc/web/web`) and staged into
// compiler/ by build.sh. core's `playc/web/compare.sh` holds the wasm build and
// the native one to the same `.nisus` bytes, which is what lets this extension
// claim it compiles what `playc --emit=nisus` would.
//
// Like every module in src/, this one does not import `vscode`, so the unit
// tests drive it in plain node against the real compiler.

"use strict";

const fs = require("node:fs");
const path = require("node:path");

// The wasm module initialises asynchronously after the loader is required. Its
// `playcWebOnReady` callback is the only signal that it is done (see core's
// `webjs.ml`), and a loader that fails during that initialisation rejects a
// promise nobody holds, so without a deadline a broken compiler would leave
// every caller waiting forever.
const READY_TIMEOUT_MS = 30_000;

// One load per process. The loader runs its initialisation as a side effect of
// `require`, and node caches the module: a second `require` would return
// without initialising again, and so without ever calling the callback.
let loading = null;

/// Load the compiler staged in `dir`. Resolves to `{ api, version }`, where
/// `api` has playc-web's `validate`, `compile`, `compileCore` and
/// `stringLiterals`, and `version` is the playwright-core it was built from (or
/// `null` when the staging recorded none).
function loadCompiler(dir) {
	loading ??= new Promise((resolve, reject) => {
		// Resolved, not joined: `require("compiler/playc_web.js")` is a package
		// name to node and would be looked for in node_modules.
		const loader = path.resolve(dir, "playc_web.js");
		if (!fs.existsSync(loader)) {
			reject(
				new Error(
					`the compiler is missing: ${loader} does not exist. ` +
						"Run build.sh in the extension's directory.",
				),
			);
			return;
		}
		const timer = setTimeout(() => {
			delete globalThis.playcWebOnReady;
			reject(new Error(`the compiler did not initialise within ${READY_TIMEOUT_MS / 1000}s`));
		}, READY_TIMEOUT_MS);
		// The loader publishes itself as the global `playcWeb` as well as through
		// the callback. An extension host is shared by every extension, so take it
		// from the callback and leave no globals behind.
		globalThis.playcWebOnReady = (api) => {
			clearTimeout(timer);
			delete globalThis.playcWebOnReady;
			delete globalThis.playcWeb;
			resolve({ api, version: readVersion(dir) });
		};
		try {
			require(loader);
		} catch (e) {
			clearTimeout(timer);
			delete globalThis.playcWebOnReady;
			reject(e);
		}
	});
	return loading;
}

function readVersion(dir) {
	try {
		return fs.readFileSync(path.join(dir, "VERSION"), "utf8").trim() || null;
	} catch {
		return null;
	}
}

/// The `compile` options for the extension's settings. `stripNames` is the
/// `stripped` writer, `playc --strip-names`: the same format with the author's
/// symbol names replaced by numbers, which is what a Playdate build ships.
function compileOptions({ typeCheck = true, stripNames = false } = {}) {
	return { format: stripNames ? "stripped" : "nisus", typeCheck };
}

/// The messages a thrown compile error carries. playc-web throws a real `Error`
/// with `errors`, one message per complaint, because the type checker reports
/// several at once; anything else that reaches here is a bug in the boundary,
/// and its own message is the best there is.
function messagesOf(e) {
	if (e && Array.isArray(e.errors) && e.errors.length > 0) return e.errors.map(String);
	return [String((e && e.message) || e)];
}

module.exports = { loadCompiler, compileOptions, messagesOf };
