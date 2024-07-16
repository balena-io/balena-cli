#!/usr/bin/env -S node --loader ts-node/esm --no-warnings=ExperimentalWarning

// ****************************************************************************
// THIS IS FOR DEV PURPOSES ONLY AND WILL NOT BE PART OF THE PUBLISHED PACKAGE
// Before opening a PR you should build and test your changes using bin/balena
// ****************************************************************************

// We boost the threadpool size as ext2fs can deadlock with some
// operations otherwise, if the pool runs out.
process.env.UV_THREADPOOL_SIZE = '64';

// Note on `fast-boot2`: We do not use `fast-boot2` with `balena-dev` because:
// * fast-boot2's cacheKiller option is configured to include the timestamps of
//   the package.json and npm-shrinkwrap.json files, to avoid unexpected CLI
//   behavior when changes are made to dependencies during development. This is
//   generally a good thing, however, `balena-dev` (a few lines below) edits
//   `package.json` to modify oclif paths, and this results in cache
//   invalidation and a performance hit rather than speedup.
// * Even if the timestamps are removed from cacheKiller, so that there is no
//   cache invalidation, fast-boot's speedup is barely noticeable when ts-node
//   is used, e.g. 1.43s vs 1.4s when running `balena version`.
// * `fast-boot` causes unexpected behavior when used with `npm link` or
//   when the `node_modules` folder is manually modified (affecting transitive
//   dependencies) during development (e.g. bug investigations). A workaround
//   is to use `balena-dev` without `fast-boot`. See also notes in
//   `CONTRIBUTING.md`.

import * as path from 'path';
import * as fs from 'fs';
const rootDir = path.join(import.meta.dirname, '..');

// Allow balena-dev to work with oclif by temporarily
// pointing oclif config options to lib/ instead of build/
modifyOclifPaths();
// Undo changes on exit
process.on('exit', function () {
	modifyOclifPaths(true);
});
// Undo changes in case of ctrl-c
process.on('SIGINT', function () {
	modifyOclifPaths(true);
	// Note process exit here will interfere with commands that do their own SIGINT handling,
	// but without it commands can not be exited.
	// So currently using balena-dev does not guarantee proper exit behaviour when using ctrl-c.
	// Ideally a better solution is needed.
	process.exit();
});

// Set the desired es version for downstream modules that support it
(await import('@balena/es-version')).set('es2018');

// Note: before ts-node v6.0.0, 'transpile-only' (no type checking) was the
// default option. We upgraded ts-node and found that adding 'transpile-only'
// was necessary to avoid a mysterious 'null' error message. On the plus side,
// it is supposed to run faster. We still benefit from type checking when
// running 'npm run build'.
// (await import('ts-node')).register({
// 	project: path.join(rootDir, 'tsconfig.json'),
// 	transpileOnly: true,
// });
(await import('../lib/app.js')).run(undefined, {
	dir: import.meta.url,
	development: true,
});

// Modify package.json oclif paths from build/ -> lib/, or vice versa
function modifyOclifPaths(revert) {
	const packageJsonPath = path.join(rootDir, 'package.json');

	const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
	const packageObj = JSON.parse(packageJson);

	if (!packageObj.oclif) {
		return;
	}

	let oclifSectionText = JSON.stringify(packageObj.oclif);
	if (!revert) {
		oclifSectionText = oclifSectionText.replace(/\/build\/lib\//g, '/lib/');
	} else {
		oclifSectionText = oclifSectionText.replace(/\/lib\//g, '/build/lib/');
	}

	packageObj.oclif = JSON.parse(oclifSectionText);
	fs.writeFileSync(
		packageJsonPath,
		`${JSON.stringify(packageObj, null, 2)}\n`,
		'utf8',
	);
}
