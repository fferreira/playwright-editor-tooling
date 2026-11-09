// Make playc-web's loader find its .wasm inside an extension.
//
// wasm_of_ocaml's loader, run under node, reads its code from
//
//     path.join(path.dirname(require.main.filename), "playc_web.assets/…")
//
// — beside the *program's main module*, not beside itself. For a script run as
// `node smoke.cjs` those are the same directory, which is why core keeps its
// node scripts next to the bundle. Inside VS Code they are not: the main module
// is VS Code's own extension host, so the unpatched loader looks for the
// compiler somewhere in VS Code's install and fails.
//
// The fix is one substitution, made when the extension is built rather than at
// run time, so the file that ships is the file the tests load:
// `<x>.dirname(require.main.filename)` becomes `__dirname`, the loader's own
// directory. The `<x>` is whatever name the minifier gave `node:path` this
// time, hence a pattern rather than a string.
//
// It must match **exactly once**. Zero means a new wasm_of_ocaml locates its
// assets some other way, and two means it does so in more than one place; in
// either case, substituting anyway would produce a compiler that fails only
// when VS Code loads it. Refusing at build time is the loud version of that.

"use strict";

const fs = require("node:fs");

const ASSET_BASE = /[A-Za-z_$][\w$]*\.dirname\(require\.main\.filename\)/g;

function patchLoader(source) {
	const found = source.match(ASSET_BASE) ?? [];
	if (found.length !== 1) {
		throw new Error(
			`playc_web.js: expected the loader to locate its assets with ` +
				`\`<path>.dirname(require.main.filename)\` exactly once, found ` +
				`${found.length}. wasm_of_ocaml has changed how it finds ` +
				`playc_web.assets/; see scripts/patch-loader.cjs.`,
		);
	}
	return source.replace(ASSET_BASE, "__dirname");
}

module.exports = { patchLoader };

if (require.main === module) {
	const [input, output] = process.argv.slice(2);
	if (!input || !output) {
		console.error("usage: patch-loader.cjs <playc_web.js> <output.js>");
		process.exit(2);
	}
	try {
		fs.writeFileSync(output, patchLoader(fs.readFileSync(input, "utf8")));
	} catch (e) {
		console.error(`FAILED: ${e.message}`);
		process.exit(1);
	}
}
