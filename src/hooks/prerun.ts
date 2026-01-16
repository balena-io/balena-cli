/**
 * @license
 * Copyright 2020 Balena Ltd.
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

import {
	type Hook,
	type Command,
	// ux
} from '@oclif/core';
import { InsufficientPrivilegesError } from '../errors.js';
import { checkLoggedIn, checkNotUsingOfflineMode } from '../utils/patterns.js';

let trackResolve: (result: Promise<any>) => void;

// note: trackPromise is subject to a Bluebird.timeout, defined in events.ts
export const trackPromise = new Promise((resolve) => {
	trackResolve = resolve;
});

/**
 * Throw InsufficientPrivilegesError if not root on Mac/Linux
 * or non-Administrator on Windows.
 *
 * Called automatically if `root=true`.
 * Can be called explicitly by command implementation, if e.g.:
 *  - check should only be done conditionally
 *  - other code needs to execute before check
 */
const checkElevatedPrivileges = async () => {
	const isElevated = await (await import('is-elevated')).default();
	if (!isElevated) {
		throw new InsufficientPrivilegesError(
			'You need root/admin privileges to run this command',
		);
	}
};

/**
 * Require elevated privileges to run.
 * When set to true, command will exit with an error
 * if executed without root on Mac/Linux
 * or if executed by non-Administrator on Windows.
 */
const DEFAULT_ROOT = false;

/**
 * Require authentication to run.
 * When set to true, command will exit with an error
 * if user is not already logged in.
 */
const DEFAULT_AUTHENTICATED = false;

/**
 * Require an internet connection to run.
 * When set to true, command will exit with an error
 * if user is running in offline mode (BALENARC_OFFLINE_MODE).
 */
const DEFAULT_OFFLINE_COMPATIBLE = false;

/**
 * This is an oclif 'prerun' hook. This hook runs after the command line is
 * parsed by oclif, but before the command's run() function is called.
 * See: https://oclif.io/docs/hooks
 *
 * This hook is used to track CLI command signatures (usage analytics).
 * A command signature is something like "env set NAME [VALUE]". That's
 * literally so: 'NAME' and 'VALUE' are NOT replaced with actual values.
 */

const hook: Hook<'prerun'> = async function (options) {
	try {
		if (
			(options.Command as Command.Class & { root: boolean }).root ??
			DEFAULT_ROOT
		) {
			await checkElevatedPrivileges();
		}

		if (
			(options.Command as Command.Class & { authenticated: boolean })
				.authenticated ??
			DEFAULT_AUTHENTICATED
		) {
			await checkLoggedIn();
		}

		if (
			// version and autocomplete come from oclif plugins, for which we cannot add offlineCompatible true
			options.Command.id !== 'version' &&
			!/^autocomplete\b/.test(options.Command.id) &&
			!(
				(options.Command as Command.Class & { offlineCompatible: boolean })
					.offlineCompatible ?? DEFAULT_OFFLINE_COMPATIBLE
			)
		) {
			checkNotUsingOfflineMode();
		}
	} catch (error) {
		this.error(error);
	}
	const events = await import('../events.js');
	const cmd = options.Command.id;

	// Intentionally do not await for the track promise here, in order to
	// run the command tracking and the command itself in parallel.
	trackResolve(events.trackCommand(cmd));
};

export default hook;
