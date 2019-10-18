#!/usr/bin/env node
'use strict';

/**
 * Check that semver v1 is greater than or equal to semver v2.
 *
 * We don't `require('semver')` to allow this script to be run as a npm
 * 'preinstall' hook, at which point no dependencies have been installed.
 */
function semverGte(v1, v2) {
	let v1Array, v2Array; // number[]
	try {
		const [, major1, minor1, patch1] = /v?(\d+)\.(\d+).(\d+)/.exec(v1);
		const [, major2, minor2, patch2] = /v?(\d+)\.(\d+).(\d+)/.exec(v2);
		v1Array = [parseInt(major1), parseInt(minor1), parseInt(patch1)];
		v2Array = [parseInt(major2), parseInt(minor2), parseInt(patch2)];
	} catch (err) {
		throw new Error(`Invalid semver versions: '${v1}' or '${v2}'`);
	}
	for (let i = 0; i < 3; i++) {
		if (v1Array[i] < v2Array[i]) {
			return false;
		} else if (v1Array[i] > v2Array[i]) {
			return true;
		}
	}
	return true;
}

function _testSemverGet() {
	const assert = require('assert').strict;
	assert(semverGte('6.4.1', '6.4.1'));
	assert(semverGte('6.4.1', 'v6.4.1'));
	assert(semverGte('v6.4.1', '6.4.1'));
	assert(semverGte('v6.4.1', 'v6.4.1'));
	assert(semverGte('6.4.1', '6.4.0'));
	assert(semverGte('6.4.1', '6.3.1'));
	assert(semverGte('6.4.1', '5.4.1'));
	assert(!semverGte('6.4.1', '6.4.2'));
	assert(!semverGte('6.4.1', '6.5.1'));
	assert(!semverGte('6.4.1', '7.4.1'));

	assert(semverGte('v6.4.1', 'v4.0.0'));
	assert(!semverGte('v6.4.1', 'v6.9.0'));
	assert(!semverGte('v6.4.1', 'v7.0.0'));
}

function checkNpmVersion() {
	const execSync = require('child_process').execSync;
	const npmVersion = execSync('npm --version')
		.toString()
		.trim();
	const requiredVersion = '6.9.0';
	if (!semverGte(npmVersion, requiredVersion)) {
		// In case you take issue with the error message below:
		//   "At this point, however, your 'npm-shrinkwrap.json' file has
		//    already been damaged"
		// ... and think: "why not add the check to the 'preinstall' hook?",
		// the reason is that it would unnecessarily prevent end users from
		// using npm v6.4.1 that ships with Node 8.  (It is OK for the
		// shrinkwrap file to get damaged if it is not going to be reused.)
		console.error(`\
-------------------------------------------------------------------------------
Error: npm version '${npmVersion}' detected. Please upgrade to npm v${requiredVersion} or later
because of a bug that causes the 'npm-shrinkwrap.json' file to be damaged.
At this point, however, your 'npm-shrinkwrap.json' file has already been
damaged. Please revert it to the master branch state with a command such as:
"git checkout master -- npm-shrinkwrap.json"
Then re-run "npm install" using npm version ${requiredVersion} or later.
-------------------------------------------------------------------------------`);
		process.exit(1);
	}
}

checkNpmVersion();
