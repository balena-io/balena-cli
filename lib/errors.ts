/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { BalenaError } from 'balena-errors';
import _ from 'lodash';
import * as os from 'os';
import { TypedError } from 'typed-error';
import { getChalk, stripIndent } from './utils/lazy.js';
import { getHelp } from './utils/messages.js';
import { CliSettings } from './utils/bootstrap.js';

export class ExpectedError extends TypedError {
	public code?: string;
	public exitCode?: number;
}

export class NotLoggedInError extends ExpectedError {}

export class InsufficientPrivilegesError extends ExpectedError {}

export class NotAvailableInOfflineModeError extends ExpectedError {}

export class InvalidPortMappingError extends ExpectedError {
	constructor(mapping: string) {
		super(`'${mapping}' is not a valid port mapping.`);
	}
}

export class NoPortsDefinedError extends ExpectedError {
	constructor() {
		super('No ports have been provided.');
	}
}

export class SIGINTError extends ExpectedError {}

/**
 * instanceOf is a more reliable implementation of the plain `instanceof`
 * typescript operator, for use with TypedError errors when the error
 * classes may be defined in external packages/dependencies.
 * Sample usage:
 *    instanceOf(err, BalenaApplicationNotFound)
 *
 * A plain Typescript `instanceof` test may fail if `npm install` results
 * in multiple instances of a package, for example multiple versions of
 * `balena-errors`:
 *     $ find node_modules -type d -name balena-errors
 *     node_modules/balena-errors
 *     node_modules/balena-sdk/node_modules/balena-errors
 *
 * In these cases, `instanceof` produces a false negative when comparing objects
 * and classes of the different package versions, but the `err.name` test still
 * succeeds.
 *
 * @param err Error object, for example in a `catch(err)` block
 * @param klass TypedError subclass, e.g. BalenaApplicationNotFound. The type
 * is annotated as 'any' for the same reason of multiple package installations
 * mentioned above.
 */
export function instanceOf(err: any, klass: any): boolean {
	if (err instanceof klass) {
		return true;
	}
	const name: string | undefined = err.name || err.constructor?.name;
	return name != null && name === klass.name;
}

function hasCode(error: any): error is Error & { code: string } {
	return error.code != null;
}

function treatFailedBindingAsMissingModule(error: any): void {
	if (error.message.startsWith('Could not locate the bindings file.')) {
		error.code = 'MODULE_NOT_FOUND';
	}
}

function interpret(error: Error): string {
	treatFailedBindingAsMissingModule(error);

	if (hasCode(error)) {
		const errorCodeHandler = messages[error.code];
		const message = errorCodeHandler && errorCodeHandler(error);

		if (message) {
			return message;
		}

		if (!_.isEmpty(error.message)) {
			return `${error.code}: ${error.message}`;
		}
	}

	return error.message;
}

function loadDataDirectory(): string {
	try {
		const settings = new CliSettings();
		return settings.get('dataDirectory') as string;
	} catch {
		return os.platform() === 'win32'
			? 'C:\\Users\\<user>\\_balena'
			: '$HOME/.balena';
	}
}

const messages: {
	[key: string]: (error: Error & { path?: string }) => string;
} = {
	EISDIR: (error) => `File is a directory: ${error.path}`,

	ENOENT: (error) => `No such file or directory: ${error.path}`,

	ENOGIT: () => stripIndent`
		Git is not installed on this system.
		Head over to http://git-scm.com to install it and run this command again.`,

	EPERM: () => stripIndent`
		You don't have sufficient privileges to run this operation.
		${
			os.platform() === 'win32'
				? 'Run a new Command Prompt as administrator and try running this command again.'
				: 'Try running this command again prefixing it with `sudo`.'
		}

		If this is not the case, and you're trying to burn an SDCard, check that the write lock is not set.`,

	EACCES: (e) => messages.EPERM(e),

	BalenaSettingsPermissionError: () => {
		const dataDirectory = loadDataDirectory();

		return stripIndent`
			Error reading data directory: "${dataDirectory}"

			This error usually indicates that the user doesn't have permissions over that directory,
			which can happen if balena CLI was executed as the root user.

			${
				os.platform() === 'win32'
					? `Try resetting the ownership by opening a new Command Prompt as administrator and running: \`takeown /f ${dataDirectory} /r\``
					: `Try resetting the ownership by running: \`sudo chown -R $(whoami) ${dataDirectory}\``
			}
		`;
	},

	ETIMEDOUT: () =>
		'Oops something went wrong, please check your connection and try again.',

	MODULE_NOT_FOUND: () => stripIndent`
		Part of the CLI could not be loaded. This typically means your CLI install is in a broken state.
		${
			os.arch() === 'x64'
				? 'You can normally fix this by uninstalling and reinstalling the CLI.'
				: stripIndent`
				You're using an unsupported architecture (${os.arch()}), so this is typically caused by missing native modules.
				Reinstalling may help, but pay attention to errors in native module build steps en route.
			`
		}
	`,

	BalenaExpiredToken: () => stripIndent`
		Looks like the session token has expired.
		Try logging in again with the "balena login" command.`,

	BalenaInvalidDeviceType: (
		error: Error & { deviceTypeSlug?: string; type?: string },
	) => {
		// TODO: The SDK should be throwing a different Error for this case.
		if (
			typeof error.type === 'string' &&
			error.type.startsWith('Incompatible ')
		) {
			return error.type;
		}
		const slug = error.deviceTypeSlug ? `"${error.deviceTypeSlug}"` : 'slug';
		return stripIndent`
			Device type ${slug} not recognized. Perhaps misspelled?
			Check available device types with "balena devices supported"`;
	},
};

// TODO remove these regexes when we have a way of uniquely indentifying errors.
// related issue https://github.com/balena-io/balena-sdk/issues/1025
// related issue https://github.com/balena-io/balena-cli/issues/2126
const EXPECTED_ERROR_REGEXES = [
	/cannot also be provided when using/, // Exclusive flag errors are all expected
	/^BalenaSettingsPermissionError/, // balena-settings-storage
	/^BalenaAmbiguousApplication/, // balena-sdk
	/^BalenaAmbiguousDevice/, // balena-sdk
	/^BalenaApplicationNotFound/, // balena-sdk
	/^BalenaDeviceNotFound/, // balena-sdk
	/^BalenaExpiredToken/, // balena-sdk
	/^BalenaInvalidDeviceType/, // balena-sdk
	/Cannot deactivate devices/i, // balena-api
	/Devices must be offline in order to be deactivated\.$/i, // balena-api
	/^BalenaOrganizationNotFound/, // balena-sdk
	/Request error: Unauthorized$/, // balena-sdk
	/^Missing \d+ required arg/, // oclif parser: RequiredArgsError
	/^Unexpected argument/, // oclif parser: UnexpectedArgsError
	/to be one of/, // oclif parser: FlagInvalidOptionError, ArgInvalidOptionError
	/must also be provided when using/, // oclif parser (depends-on)
	/^Expected an integer/, // oclif parser (flags.integer)
	/^Flag .* expects a value/, // oclif parser
	/^Error parsing config file.*balenarc\.yml/,
];

// Support unit testing of handleError
export const getSentry = async function () {
	return await import('@sentry/node');
};

async function sentryCaptureException(error: Error) {
	const Sentry = await getSentry();
	Sentry.captureException(error);
	try {
		await Sentry.close(1000);
	} catch (e) {
		if (process.env.DEBUG) {
			console.error('[debug] Timeout reporting error to sentry.io');
		}
	}
}

export async function handleError(error: Error | string) {
	// If a module has thrown a string, convert to error
	if (typeof error === 'string') {
		error = new Error(error);
	}

	// Set appropriate exitCode
	process.exitCode =
		(error as BalenaError).exitCode === 0
			? 0
			: Math.trunc((error as BalenaError).exitCode) || process.exitCode || 1;

	// Prepare message
	const message = [interpret(error)];

	if (error.stack && process.env.DEBUG) {
		message.push('\n' + error.stack);
	}

	// Expected?
	const isExpectedError =
		error instanceof ExpectedError ||
		EXPECTED_ERROR_REGEXES.some((re) => re.test(message[0])) ||
		EXPECTED_ERROR_REGEXES.some((re) => re.test((error as BalenaError).code));

	// Output/report error
	if (isExpectedError) {
		printExpectedErrorMessage(message.join('\n'));
	} else {
		printErrorMessage(message.join('\n'));

		// Report "unexpected" errors via Sentry.io
		if (!process.env.BALENARC_NO_SENTRY) {
			await sentryCaptureException(error);
		}
	}
	if (error instanceof SIGINTError || !isExpectedError) {
		// SIGINT or unexpected error: ensure that the process terminates.
		// The exit error code was set above through `process.exitCode`.
		process.exit();
	}
}

export const printErrorMessage = function (message: string) {
	const chalk = getChalk();

	// Only first line should be red
	const messageLines = message.split('\n');
	console.error(chalk.red(messageLines.shift()));

	messageLines.forEach((line) => {
		console.error(line);
	});

	console.error(`\n${getHelp()}\n`);
};

export const printExpectedErrorMessage = function (message: string) {
	console.error(`${message}\n`);
};
