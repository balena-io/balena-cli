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

import type { AppOptions } from './preparser';
import {
	checkDeletedCommand,
	preparseArgs,
	unsupportedFlag,
} from './preparser';
import { CliSettings } from './utils/bootstrap';
import { getPackageJson, onceAsync } from './utils/lazy';
import { run as mainRun, settings, Errors } from '@oclif/core';

/**
 * Sentry.io setup
 * @see https://docs.sentry.io/error-reporting/quickstart/?platform=node
 */
export const setupSentry = onceAsync(async () => {
	const config = await import('./config');
	const Sentry = await import('@sentry/node');
	Sentry.init({
		dsn: config.sentryDsn,
		release: getPackageJson().version,
	});
	Sentry.getCurrentScope().setExtras({
		node_version: process.version,
		platform: process.platform,
	});
});

async function checkNodeVersion() {
	const validNodeVersions = getPackageJson().engines.node;
	if (!(await import('semver')).satisfies(process.version, validNodeVersions)) {
		const { getNodeEngineVersionWarn } = await import('./utils/messages');
		console.warn(getNodeEngineVersionWarn(process.version, validNodeVersions));
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

/** Selected CLI initialization steps */
async function init() {
	if (process.env.BALENARC_NO_SENTRY) {
		if (process.env.DEBUG) {
			console.error(`WARN: disabling Sentry.io error reporting`);
		}
	} else {
		await setupSentry();
	}
	await checkNodeVersion();

	const settings = new CliSettings();

	// Proxy setup should be done early on, before loading balena-sdk
	await (await import('./utils/proxy')).setupGlobalHttpProxy(settings);

	setupBalenaSdkSharedOptions(settings);

	// check for CLI updates once a day
	if (!process.env.BALENARC_OFFLINE_MODE) {
		(await import('./utils/update')).notify();
	}
}

/** Execute the oclif parser and the CLI command. */
async function oclifRun(command: string[], options: AppOptions) {
	let deprecationPromise: Promise<void> | undefined;
	// check and enforce the CLI's deprecation policy
	if (!(unsupportedFlag || process.env.BALENARC_UNSUPPORTED)) {
		const { DeprecationChecker } = await import('./deprecation');
		const deprecationChecker = new DeprecationChecker(getPackageJson().version);
		// warnAndAbortIfDeprecated uses previously cached data only
		await deprecationChecker.warnAndAbortIfDeprecated();
		// checkForNewReleasesIfNeeded may query the npm registry
		deprecationPromise = deprecationChecker.checkForNewReleasesIfNeeded();
	}

	const runPromise = (async function (shouldFlush: boolean) {
		let isEEXIT = false;
		try {
			if (options.development) {
				// In dev mode -> use ts-node and dev plugins
				process.env.NODE_ENV = 'development';
				settings.debug = true;
			}
			// For posteriority: We can't use default oclif 'execute' as
			// We customize error handling and flushing
			await mainRun(command, options.loadOptions ?? options.dir);
		} catch (error) {
			// oclif sometimes exits with ExitError code EEXIT 0 (not an error),
			// for example the `balena help` command.
			// (Avoid `error instanceof ExitError` here for the reasons explained
			// in the CONTRIBUTING.md file regarding the `instanceof` operator.)
			if (error.oclif?.exit === 0) {
				isEEXIT = true;
			} else {
				if (error instanceof Errors.CLIError) {
					const RequiredArgsErrorRegex = /^Missing (\d+) required arg(s?\b)/;
					if (RequiredArgsErrorRegex.exec(error.message) != null) {
						error.message = error.message
							.split('\n')
							.map((line, i) => {
								if (i === 0) {
									// Replace 'arg(s)' with 'argument(s)'
									return line.replace(
										RequiredArgsErrorRegex,
										'Missing $1 required argument$2',
									);
								}
								// Add a ':' between the missing argument name and its description
								return line.replace(
									/^(?<argName>[\w-]+)(?<paddingSpaces>[ ]+)[ ](?<description>\w)/,
									'$<argName>$<paddingSpaces>: $<description>',
								);
							})
							.join('\n');
						// Print the whole command used along with '--help'
						const helpCommand = `balena ${command.map((c, i) => (i === 0 ? c.replace(/:/g, ' ') : c)).join(' ')} --help`;
						error.message = error.message.replace(
							'\nSee more help with --help',
							`\nSee more help with \`${helpCommand}\``,
						);
					}
				}
				throw error;
			}
		}
		if (shouldFlush) {
			const { flush } = await import('@oclif/core');
			await flush();
		}
		// TODO: figure out why we need to call fast-boot stop() here, in
		// addition to calling it in the main `run()` function in this file.
		// If it is not called here as well, there is a process exit delay of
		// 1 second when the fast-boot2 cache is modified (1 second is the
		// default cache saving timeout). Try for example `balena help`.
		// I have found that, when oclif's `Error: EEXIT: 0` is caught in
		// the try/catch block above, execution does not get past the
		// Promise.all() call below, but I don't understand why.
		if (isEEXIT) {
			(await import('./fast-boot')).stop();
		}
	})(!options.noFlush);

	const { trackPromise } = await import('./hooks/prerun');

	await Promise.all([trackPromise, deprecationPromise, runPromise]);
}

/** CLI entrypoint. Called by the `bin/run.js` and `bin/dev.js` scripts. */
export async function run(cliArgs = process.argv, options: AppOptions) {
	try {
		const { setOfflineModeEnvVars, normalizeEnvVars } = await import(
			'./utils/bootstrap'
		);
		setOfflineModeEnvVars();
		normalizeEnvVars();

		await init();

		// Look for commands that have been removed and if so, exit with a notice
		checkDeletedCommand(cliArgs.slice(2));

		const args = await preparseArgs(cliArgs);
		await oclifRun(args, options);
	} catch (err) {
		await (await import('./errors')).handleError(err);
	} finally {
		try {
			(await import('./fast-boot')).stop();
		} catch (e) {
			if (process.env.DEBUG) {
				console.error(`[debug] Stopping fast-boot: ${e}`);
			}
		}
		// Windows fix: reading from stdin prevents the process from exiting
		process.stdin.pause();
	}
}
