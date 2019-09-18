/*
Copyright 2016-2017 Balena

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

import * as Bluebird from 'bluebird';
import { stripIndent } from 'common-tags';
import * as _ from 'lodash';
import * as os from 'os';
import * as Raven from 'raven';

import * as patterns from './utils/patterns';

const captureException = Bluebird.promisify<string, Error>(
	Raven.captureException,
	{ context: Raven },
);

function hasCode(error: any): error is Error & { code: string } {
	return error.code != null;
}

function treatFailedBindingAsMissingModule(error: any): void {
	if (error.message.startsWith('Could not locate the bindings file.')) {
		error.code = 'MODULE_NOT_FOUND';
	}
}

function interpret(error: any): string | undefined {
	if (!(error instanceof Error)) {
		return;
	}

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
	} else {
		return error.message;
	}
}

const messages: {
	[key: string]: (error: Error & { path?: string }) => string;
} = {
	EISDIR: error => `File is a directory: ${error.path}`,

	ENOENT: error => `No such file or directory: ${error.path}`,

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

	EACCES: e => messages.EPERM(e),

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
		Looks like your session token is expired.
		Please try logging in again with:
			$ balena login`,
};

export async function handleError(error: any) {
	let message = interpret(error);
	if (message == null) {
		return;
	}

	if (process.env.DEBUG) {
		message = error.stack;
	}

	patterns.printErrorMessage(message!);

	await captureException(error)
		.timeout(1000)
		.catch(function() {
			// Ignore any errors (from error logging, or timeouts)
		})
		.finally(() => process.exit(error.exitCode || 1));
}
