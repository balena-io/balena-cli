#!/usr/bin/env node
'use strict';
import { execSync } from 'child_process';

/**
 * Check that semver v1 is greater than or equal to semver v2.
 *
 * We don't `require('semver')` to allow this script to be run as a npm
 * 'preinstall' hook, at which point no dependencies have been installed.
 *
 * @param {string} version
 */
function parseSemver(version) {
	const match = /v?(\d+)\.(\d+).(\d+)/.exec(version);
	if (match == null) {
		throw new Error(`Invalid semver version: ${version}`);
	}
	const [, major, minor, patch] = match;
	return [parseInt(major, 10), parseInt(minor, 10), parseInt(patch, 10)];
}

/**
 * @param {string} v1
 * @param {string} v2
 */
function semverGte(v1, v2) {
	const v1Array = parseSemver(v1);
	const v2Array = parseSemver(v2);
	for (let i = 0; i < 3; i++) {
		if (v1Array[i] < v2Array[i]) {
			return false;
		} else if (v1Array[i] > v2Array[i]) {
			return true;
		}
	}
	return true;
}

function checkNpmVersion() {
	const npmVersion = execSync('npm --version').toString().trim();
	const requiredVersion = '6.9.0';
	if (!semverGte(npmVersion, requiredVersion)) {
		// In case you take issue with the error message below:
		//   "At this point, however, your 'npm-shrinkwrap.json' file has
		//    already been damaged"
		// ... and think: "why not add the check to the 'preinstall' hook?",
		// the reason is that it would unnecessarily prevent end users from
		// using npm v6.4.1 that ships with Node 8.  (It is OK for the
		// shrinkwrap file to get damaged if it is not going to be reused.)
		throw new Error(`\
-----------------------------------------------------------------------------
Error: npm version '${npmVersion}' detected. Please upgrade to npm v${requiredVersion} or later
because of a bug that causes the 'npm-shrinkwrap.json' file to be damaged.
At this point, however, your 'npm-shrinkwrap.json' file has already been
damaged. Please revert it to the master branch state with a command such as:
"git checkout master -- npm-shrinkwrap.json"
Then re-run "npm install" using npm version ${requiredVersion} or later.
-----------------------------------------------------------------------------`);
	}
}

function main() {
	try {
		checkNpmVersion();
	} catch (e) {
		console.error(e.message || e);
		process.exitCode = 1;
	}
}

main();
