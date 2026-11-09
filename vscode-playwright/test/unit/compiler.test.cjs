// The staged compiler loads, and compiles what `playc` compiles.
//
// This file is also the test of scripts/patch-loader.cjs. node runs it with
// *this* file as the main module, in test/unit/, so an unpatched loader would
// look for its .wasm in test/unit/playc_web.assets/ and fail — the same way it
// fails inside VS Code, where the main module is the extension host.

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { loadCompiler, compileOptions, messagesOf } = require("../../src/compiler");
const { COMPILER, COIN, ILL_TYPED } = require("./support.cjs");

const MAGIC = Buffer.from([0xc0, 0xde, 0xda, 0x7a]);

test("the compiler loads from compiler/, wherever the main module is", async () => {
	const { api, version } = await loadCompiler(COMPILER);
	for (const name of ["validate", "compile", "compileCore", "stringLiterals"]) {
		assert.strictEqual(typeof api[name], "function", `playc-web exports ${name}`);
	}
	assert.match(version, /^v\d+\.\d+\.\d+/, "build.sh records the playwright-core version");
});

test("loading leaves no globals behind in a shared extension host", async () => {
	await loadCompiler(COMPILER);
	assert.strictEqual(globalThis.playcWeb, undefined);
	assert.strictEqual(globalThis.playcWebOnReady, undefined);
});

test("a second load is the first one", async () => {
	assert.strictEqual(await loadCompiler(COMPILER), await loadCompiler(COMPILER));
});

test("a relative directory is a directory, not a package name", async () => {
	const relative = require("node:path").relative(process.cwd(), COMPILER);
	const { spawnSync } = require("node:child_process");
	// In a process of its own: this one has already loaded the compiler.
	const run = spawnSync(
		process.execPath,
		["-e", `require(${JSON.stringify(require.resolve("../../src/compiler"))}).loadCompiler(${JSON.stringify(relative)}).then(() => console.log("loaded"), (e) => { console.error(e.message); process.exit(1); })`],
		{ encoding: "utf8" },
	);
	assert.strictEqual(run.status, 0, run.stderr);
	assert.match(run.stdout, /loaded/);
});

test("compiling writes a .nisus, and stripping names makes it smaller", async () => {
	const { api } = await loadCompiler(COMPILER);
	const nisus = Buffer.from(api.compile(COIN, compileOptions({})));
	assert.deepStrictEqual(nisus.subarray(0, 4), MAGIC, "a .nisus opens with 0xC0DEDA7A");
	const stripped = Buffer.from(api.compile(COIN, compileOptions({ stripNames: true })));
	assert.deepStrictEqual(stripped.subarray(0, 4), MAGIC, "stripping is a writer policy, not a format");
	assert.ok(stripped.length < nisus.length);
});

test("compileOptions is the settings, in playc-web's terms", () => {
	assert.deepStrictEqual(compileOptions({}), { format: "nisus", typeCheck: true });
	assert.deepStrictEqual(compileOptions({ stripNames: true, typeCheck: false }), {
		format: "stripped",
		typeCheck: false,
	});
});

test("type checking is the setting's to turn off", async () => {
	const { api } = await loadCompiler(COMPILER);
	assert.throws(() => api.compile(ILL_TYPED, compileOptions({})), /type error/);
	assert.doesNotThrow(() => api.compile(ILL_TYPED, compileOptions({ typeCheck: false })));
});

test("messagesOf reads every message a compile failure carries", async () => {
	const { api } = await loadCompiler(COMPILER);
	try {
		api.compile("-> Hi [-> nowhere]\n");
		assert.fail("a jump to a missing label compiles");
	} catch (e) {
		assert.deepStrictEqual(messagesOf(e), ["no moment is labelled `nowhere`"]);
	}
	assert.deepStrictEqual(messagesOf(new Error("plain")), ["plain"]);
	assert.deepStrictEqual(messagesOf("thrown string"), ["thrown string"]);
});
