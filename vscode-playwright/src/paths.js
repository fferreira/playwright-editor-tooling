// Where a compiled `.nisus` goes.
//
// Beside its `.play` by default, as `playc --emit=nisus` writes it. With an
// output directory set, the `.play`'s place in the workspace is kept under it,
// so `stories/a.play` and `drafts/a.play` do not both become `out/a.nisus` and
// overwrite each other.

"use strict";

const path = require("node:path");

/// The `.nisus` path for the `.play` at `playPath`.
///
/// `outputDirectory` is the setting as written: empty for beside the source, or
/// a directory, relative to `workspaceRoot` unless it is absolute.
/// `workspaceRoot` is the folder containing the `.play`, or `null` when it is
/// in none; a relative output directory then has nothing to be relative to, so
/// the `.nisus` goes beside the source.
function nisusPath(playPath, { outputDirectory = "", workspaceRoot = null } = {}) {
	const name = `${path.basename(playPath, path.extname(playPath))}.nisus`;
	const beside = path.join(path.dirname(playPath), name);
	if (!outputDirectory) return beside;
	if (path.isAbsolute(outputDirectory)) return path.join(outputDirectory, name);
	if (!workspaceRoot) return beside;
	const within = path.relative(workspaceRoot, path.dirname(playPath));
	const inside = within.split(path.sep)[0] !== ".." && !path.isAbsolute(within);
	return path.join(workspaceRoot, outputDirectory, inside ? within : "", name);
}

module.exports = { nisusPath };
