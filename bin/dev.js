#!/usr/bin/env node

// ****************************************************************************
// THIS IS FOR DEV PURPOSES ONLY AND WILL NOT BE PART OF THE PUBLISHED PACKAGE
// Before opening a PR you should build and test your changes using bin/balena
// ****************************************************************************

// We boost the threadpool size as ext2fs can deadlock with some
// operations otherwise, if the pool runs out.
process.env.UV_THREADPOOL_SIZE = '64';

const path = require('path');
const rootDir = path.join(__dirname, '..');

// Allow balena-dev to work with oclif by temporarily
// pointing oclif config options to src/ instead of build/
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
require('@balena/es-version').set('es2018');

// Note: before ts-node v6.0.0, 'transpile-only' (no type checking) was the
// default option. We upgraded ts-node and found that adding 'transpile-only'
// was necessary to avoid a mysterious 'null' error message. On the plus side,
// it is supposed to run faster. We still benefit from type checking when
// running 'npm run build'.
require('ts-node').register({
	project: path.join(rootDir, 'tsconfig.json'),
	transpileOnly: true,
});
void require('../src/app').run(undefined, {
	dir: __dirname,
	development: true,
});

// Modify package.json oclif paths from build/ -> src/, or vice versa
function modifyOclifPaths(revert) {
	const fs = require('fs');
	const packageJsonPath = path.join(rootDir, 'package.json');

	const packageJson = fs.readFileSync(packageJsonPath, 'utf8');
	const packageObj = JSON.parse(packageJson);

	if (!packageObj.oclif) {
		return;
	}

	let oclifSectionText = JSON.stringify(packageObj.oclif);
	if (!revert) {
		oclifSectionText = oclifSectionText.replace(/\/build\//g, '/src/');
	} else {
		oclifSectionText = oclifSectionText.replace(/\/src\//g, '/build/');
	}

	packageObj.oclif = JSON.parse(oclifSectionText);
	fs.writeFileSync(
		packageJsonPath,
		`${JSON.stringify(packageObj, null, 2)}\n`,
		'utf8',
	);
}
