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

import type { Hook } from '@oclif/core';
import { InsufficientPrivilegesError } from '../errors';
import { checkLoggedIn, checkNotUsingOfflineMode } from '../utils/patterns';

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
	const isElevated = await (await import('is-elevated'))();
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

const hook: Hook<'init'> = async function (options) {
	if (!options.id) {
		return;
	}
	const command = this.config.findCommand(options.id);
	if (!command) {
		return;
	}
	try {
		if (command.root ?? DEFAULT_ROOT) {
			await checkElevatedPrivileges();
		}

		if (command.authenticated ?? DEFAULT_AUTHENTICATED) {
			await checkLoggedIn();
		}

		if (!(command.offlineCompatible ?? DEFAULT_OFFLINE_COMPATIBLE)) {
			await checkNotUsingOfflineMode();
		}
	} catch (error) {
		console.error(typeof error === 'string' ? error : error.message);
		throw error;
	}
};

export default hook;
