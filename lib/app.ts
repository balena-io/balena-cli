/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import * as packageJSON from '../package.json';
import { CliSettings } from './utils/bootstrap';
import { onceAsync, stripIndent } from './utils/lazy';

/**
 * Sentry.io setup
 * @see https://docs.sentry.io/error-reporting/quickstart/?platform=node
 */
export const setupSentry = onceAsync(async () => {
	const config = await import('./config');
	const Sentry = await import('@sentry/node');
	Sentry.init({
		dsn: config.sentryDsn,
		release: packageJSON.version,
	});
	Sentry.configureScope((scope) => {
		scope.setExtras({
			is_pkg: !!(process as any).pkg,
			node_version: process.version,
			platform: process.platform,
		});
	});
	return Sentry.getCurrentHub();
});

async function checkNodeVersion() {
	const validNodeVersions = packageJSON.engines.node;
	if (!(await import('semver')).satisfies(process.version, validNodeVersions)) {
		console.warn(stripIndent`
			------------------------------------------------------------------------------
			Warning: Node version "${process.version}" does not match required versions "${validNodeVersions}".
			This may cause unexpected behavior. To upgrade Node, visit:
			https://nodejs.org/en/download/
			------------------------------------------------------------------------------
			`);
	}
}

/** Setup balena-sdk options that are shared with imported packages */
function setupBalenaSdkSharedOptions(settings: CliSettings) {
	const BalenaSdk = require('balena-sdk') as typeof import('balena-sdk');
	BalenaSdk.setSharedOptions({
		apiUrl: settings.get<string>('apiUrl'),
		dataDirectory: settings.get<string>('dataDirectory'),
	});
}

/**
 * Addresses the console warning:
 * (node:49500) MaxListenersExceededWarning: Possible EventEmitter memory
 * leak detected. 11 error listeners added. Use emitter.setMaxListeners() to
 * increase limit
 */
export function setMaxListeners(maxListeners: number) {
	require('events').EventEmitter.defaultMaxListeners = maxListeners;
}

/** Selected CLI initialization steps */
async function init() {
	if (process.env.BALENARC_NO_SENTRY) {
		console.error(`WARN: disabling Sentry.io error reporting`);
	} else {
		await setupSentry();
	}
	checkNodeVersion();

	const settings = new CliSettings();

	// Proxy setup should be done early on, before loading balena-sdk
	await (await import('./utils/proxy')).setupGlobalHttpProxy(settings);

	setupBalenaSdkSharedOptions(settings);

	// check for CLI updates once a day
	(await import('./utils/update')).notify();
}

/** Execute the oclif parser and the CLI command. */
async function oclifRun(
	command: string[],
	options: import('./preparser').AppOptions,
) {
	const { CustomMain } = await import('./utils/oclif-utils');
	const runPromise = CustomMain.run(command).then(
		() => {
			if (!options.noFlush) {
				return require('@oclif/command/flush');
			}
		},
		(error) => {
			// oclif sometimes exits with ExitError code 0 (not an error)
			// (Avoid `error instanceof ExitError` here for the reasons explained
			// in the CONTRIBUTING.md file regarding the `instanceof` operator.)
			if (error.oclif?.exit === 0) {
				return;
			} else {
				throw error;
			}
		},
	);
	const { trackPromise } = await import('./hooks/prerun/track');
	await Promise.all([trackPromise, runPromise]);
}

/** CLI entrypoint. Called by the `bin/balena` and `bin/balena-dev` scripts. */
export async function run(
	cliArgs = process.argv,
	options: import('./preparser').AppOptions = {},
) {
	try {
		const { normalizeEnvVars, pkgExec } = await import('./utils/bootstrap');
		normalizeEnvVars();

		// The 'pkgExec' special/internal command provides a Node.js interpreter
		// for use of the standalone zip package. See pkgExec function.
		if (cliArgs.length > 3 && cliArgs[2] === 'pkgExec') {
			return pkgExec(cliArgs[3], cliArgs.slice(4));
		}

		await init();

		const { preparseArgs, checkDeletedCommand } = await import('./preparser');

		// Look for commands that have been removed and if so, exit with a notice
		checkDeletedCommand(cliArgs.slice(2));

		const args = await preparseArgs(cliArgs);
		await oclifRun(args, options);
	} catch (err) {
		await (await import('./errors')).handleError(err);
	} finally {
		// Windows fix: reading from stdin prevents the process from exiting
		process.stdin.pause();
	}
}
