// The loader patch makes one substitution, or none at all.

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const { patchLoader } = require("../../scripts/patch-loader.cjs");

const LOADER = 'function X(a){const b=require("node:path"),c=b.join(b.dirname(require.main.filename),a);return c}';

test("the asset base becomes the loader's own directory", () => {
	assert.strictEqual(
		patchLoader(LOADER),
		'function X(a){const b=require("node:path"),c=b.join(__dirname,a);return c}',
	);
});

test("whatever the minifier called node:path", () => {
	assert.match(patchLoader("q$1.dirname(require.main.filename)"), /^__dirname$/);
});

test("a loader that finds its assets some other way is refused", () => {
	assert.throws(() => patchLoader("fetch(new URL(a, document.currentScript.src))"), /found 0/);
});

test("a loader that finds them in two places is refused", () => {
	assert.throws(() => patchLoader(`${LOADER};${LOADER}`), /found 2/);
});
