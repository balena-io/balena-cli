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

/**
 * Simple command-line pre-parsing to choose between oclif or Capitano.
 * @param argv process.argv
 */
function routeCliFramework(argv: string[]): void {
	if (process.env.DEBUG) {
		console.log(
			`Debug: original argv0="${process.argv0}" argv=[${argv}] length=${
				argv.length
			}`,
		);
	}
	const cmdSlice = argv.slice(2);
	let isOclif = false;

	if (cmdSlice.length > 1) {
		// convert e.g. 'balena help env add' to 'balena env add --help'
		if (cmdSlice[0] === 'help') {
			cmdSlice.shift();
			cmdSlice.push('--help');
		}
		// Look for commands that have been transitioned to oclif
		isOclif = isOclifCommand(cmdSlice);
		if (isOclif) {
			// convert space-separated commands to oclif's topic:command syntax
			argv = [
				argv[0],
				argv[1],
				cmdSlice[0] + ':' + cmdSlice[1],
				...cmdSlice.slice(2),
			];
		}
	}
	if (isOclif) {
		if (process.env.DEBUG) {
			console.log(`Debug: oclif new argv=[${argv}] length=${argv.length}`);
		}
		require('./app-oclif').run(argv);
	} else {
		require('./app-capitano');
	}
}

/**
 * Determine whether the CLI command has been converted from Capitano to ocif.
 * @param argvSlice process.argv.slice(2)
 */
function isOclifCommand(argvSlice: string[]): boolean {
	// Look for commands that have been transitioned to oclif
	if (argvSlice.length > 1) {
		// balena env add
		if (argvSlice[0] === 'env' && argvSlice[1] === 'add') {
			return true;
		}
	}
	return false;
}

/**
 * CLI entrypoint, but see also `bin/balena` and `bin/balena-dev` which
 * call this function.
 */
export function run(): void {
	// globalInit() must be called very early on (before other imports) because
	// it sets up Sentry error reporting, global HTTP proxy settings, balena-sdk
	// shared options, and performs node version requirement checks.
	require('./app-common').globalInit();
	routeCliFramework(process.argv);
}
