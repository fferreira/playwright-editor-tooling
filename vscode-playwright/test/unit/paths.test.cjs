// Where a compiled .nisus goes.

"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("node:path");
const { nisusPath } = require("../../src/paths");

const ROOT = path.join(path.sep, "work", "game");
const at = (...parts) => path.join(ROOT, ...parts);

test("beside the .play by default, as playc writes it", () => {
	assert.strictEqual(nisusPath(at("The cave.play")), at("The cave.nisus"));
	assert.strictEqual(nisusPath(at("stories", "a.play"), { workspaceRoot: ROOT }), at("stories", "a.nisus"));
});

test("a relative output directory keeps each story's place in the workspace", () => {
	const options = { outputDirectory: "out", workspaceRoot: ROOT };
	assert.strictEqual(nisusPath(at("a.play"), options), at("out", "a.nisus"));
	assert.strictEqual(nisusPath(at("stories", "a.play"), options), at("out", "stories", "a.nisus"));
	assert.strictEqual(nisusPath(at("drafts", "a.play"), options), at("out", "drafts", "a.nisus"));
});

test("an absolute output directory takes the name alone", () => {
	const out = path.join(path.sep, "tmp", "nisus");
	assert.strictEqual(
		nisusPath(at("stories", "a.play"), { outputDirectory: out, workspaceRoot: ROOT }),
		path.join(out, "a.nisus"),
	);
});

test("a .play outside the workspace folder is not given a ../ path under it", () => {
	const elsewhere = path.join(path.sep, "elsewhere", "b.play");
	assert.strictEqual(
		nisusPath(elsewhere, { outputDirectory: "out", workspaceRoot: ROOT }),
		at("out", "b.nisus"),
	);
	// A sibling whose name merely starts with two dots is still inside.
	assert.strictEqual(
		nisusPath(at("..drafts", "c.play"), { outputDirectory: "out", workspaceRoot: ROOT }),
		at("out", "..drafts", "c.nisus"),
	);
});

test("with no workspace folder a relative output directory has nothing to be relative to", () => {
	assert.strictEqual(nisusPath(at("a.play"), { outputDirectory: "out" }), at("a.nisus"));
});

test("only the last extension is replaced", () => {
	assert.strictEqual(nisusPath(at("chapter.1.play")), at("chapter.1.nisus"));
	assert.strictEqual(nisusPath(at("noext")), at("noext.nisus"));
});
