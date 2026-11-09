// What the unit tests share: where the staged compiler is, and where core is.

"use strict";

const path = require("node:path");
const { execFileSync } = require("node:child_process");

const EXTENSION = path.join(__dirname, "..", "..");
const COMPILER = path.join(EXTENSION, "compiler");

/// The playwright-core checkout tools/core_dir.sh finds, or `null`.
function coreDir() {
	try {
		return execFileSync(path.join(EXTENSION, "..", "tools", "core_dir.sh"), { encoding: "utf8" }).trim();
	} catch {
		return null;
	}
}

const COIN = `<<
+[coin]
>>
-> A coin lies on the floor.
=> Pick it up [-> rich] -=[coin]
=> Leave it [-> poor]
@rich -> You have a coin.
@poor -> You have nothing.
`;

const ILL_TYPED = `{{
  thing : type
  f : number -> thing
}}
<<
+[f["not a number"]]
>>
-> Hi
`;

module.exports = { EXTENSION, COMPILER, coreDir, COIN, ILL_TYPED };
