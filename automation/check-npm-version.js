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
		console.error(`\
Error: npm version '${npmVersion}' detected. Please upgrade to npm v${requiredVersion} or later
because of a bug affecting older versions in relation to the npm-shrinkwrap.json file.`);
		process.exit(1);
	}
}

checkNpmVersion();
