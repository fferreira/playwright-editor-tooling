// An extension built without its compiler says what to do about it.
//
// A file of its own because `loadCompiler` loads once per process, and every
// test file is its own process.

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { loadCompiler } = require("../../src/compiler");

test("a missing compiler is an error that names build.sh", async () => {
	await assert.rejects(loadCompiler(path.join(__dirname, "no-such-directory")), /build\.sh/);
	assert.strictEqual(globalThis.playcWebOnReady, undefined);
});
