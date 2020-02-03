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
 * CLI entrypoint, but see also `bin/balena` and `bin/balena-dev` which
 * call this function.
 */
export async function run(
	cliArgs = process.argv,
	options: import('./preparser').AppOptions = {},
) {
	// DEBUG set to falsy for negative values else is truthy
	process.env.DEBUG = ['0', 'no', 'false', '', undefined].includes(
		process.env.DEBUG?.toLowerCase(),
	)
		? ''
		: '1';

	// The 'pkgExec' special/internal command provides a Node.js interpreter
	// for use of the standalone zip package. See pkgExec function.
	if (cliArgs.length > 3 && cliArgs[2] === 'pkgExec') {
		return pkgExec(cliArgs[3], cliArgs.slice(4));
	}

	const { globalInit } = await import('./app-common');
	const { routeCliFramework } = await import('./preparser');

	// globalInit() must be called very early on (before other imports) because
	// it sets up Sentry error reporting, global HTTP proxy settings, balena-sdk
	// shared options, and performs node version requirement checks.
	await globalInit();
	await routeCliFramework(cliArgs, options);

	// Windows fix: reading from stdin prevents the process from exiting
	process.stdin.pause();
}

/**
 * Implements the 'pkgExec' command, used as a way to provide a Node.js
 * interpreter for child_process.spawn()-like operations when the CLI is
 * executing as a standalone zip package (built-in Node interpreter) and
 * the system may not have a separate Node.js installation. A present use
 * case is a patched version of the 'windosu' package that requires a
 * Node.js interpreter to spawn a privileged child process.
 *
 * @param modFunc Path to a JS module that will be executed via require().
 * The modFunc argument may optionally contain a function name separated
 * by '::', for example '::main' in:
 * 'C:\\snapshot\\balena-cli\\node_modules\\windosu\\lib\\pipe.js::main'
 * in which case that function is executed in the require'd module.
 * @param args Optional arguments to passed through process.argv and as
 * arguments to the function specified via modFunc.
 */
async function pkgExec(modFunc: string, args: string[]) {
	const [modPath, funcName] = modFunc.split('::');
	let replacedModPath = modPath;
	const match = modPath
		.replace(/\\/g, '/')
		.match(/\/snapshot\/balena-cli\/(.+)/);
	if (match) {
		replacedModPath = `../${match[1]}`;
	}
	process.argv = [process.argv[0], process.argv[1], ...args];
	try {
		const mod: any = await import(replacedModPath);
		if (funcName) {
			await mod[funcName](...args);
		}
	} catch (err) {
		console.error(`Error executing pkgExec "${modFunc}" [${args.join()}]`);
		console.error(err);
	}
}
