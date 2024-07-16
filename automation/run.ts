/**
 * @license
 * Copyright 2019 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import _ from 'lodash';

import {
	buildOclifInstaller,
	buildStandaloneZip,
	catchUncommitted,
	signFilesForNotarization,
	testShrinkwrap,
} from './build-bin';
import { updateDescriptionOfReleasesAffectedByIssue1359 } from './deploy-bin.js';

// DEBUG set to falsy for negative values else is truthy
process.env.DEBUG = ['0', 'no', 'false', '', undefined].includes(
	process.env.DEBUG?.toLowerCase(),
)
	? ''
	: '1';

/**
 * Trivial command-line parser. Check whether the command-line argument is one
 * of the following strings, then call the appropriate functions:
 *     'build:installer'   (to build a native oclif installer)
 * 	   'build:standalone'  (to build a standalone pkg package)
 *
 * @param args Arguments to parse (default is process.argv.slice(2))
 */
async function parse(args?: string[]) {
	args = args || process.argv.slice(2);
	console.error(`[debug] automation/run.ts process.argv=[${process.argv}]`);
	console.error(`[debug] automation/run.ts args=[${args}]`);
	if (_.isEmpty(args)) {
		throw new Error('missing command-line arguments');
	}
	const commands: { [cmd: string]: () => void | Promise<void> } = {
		'build:installer': buildOclifInstaller,
		'build:standalone': buildStandaloneZip,
		'sign:binaries': signFilesForNotarization,
		'catch-uncommitted': catchUncommitted,
		'test-shrinkwrap': testShrinkwrap,
		fix1359: updateDescriptionOfReleasesAffectedByIssue1359,
	};
	for (const arg of args) {
		if (!Object.hasOwn(commands, arg)) {
			throw new Error(`command unknown: ${arg}`);
		}
	}

	for (const arg of args) {
		try {
			const cmdFunc = commands[arg];
			await cmdFunc();
		} catch (err) {
			if (typeof err === 'object') {
				err.message = `"${arg}": ${err.message}`;
			}
			throw err;
		}
	}
}

/** See jsdoc for parse() function above */
export async function run(args?: string[]) {
	try {
		await parse(args);
	} catch (e) {
		console.error(e.message ? `Error: ${e.message}` : e);
		process.exitCode = 1;
	}
}

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
