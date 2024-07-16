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

import { Command } from '@oclif/core';
import {
	InsufficientPrivilegesError,
	NotAvailableInOfflineModeError,
} from './errors.js';
import { stripIndent } from './utils/lazy.js';
import * as output from './framework/output.js';

export default abstract class BalenaCommand extends Command {
	/**
	 * When set to true, command will be listed in `help`,
	 * otherwise listed in `help --verbose` with secondary commands.
	 */
	public static primary = false;

	/**
	 * Require elevated privileges to run.
	 * When set to true, command will exit with an error
	 * if executed without root on Mac/Linux
	 * or if executed by non-Administrator on Windows.
	 */
	public static root = false;

	/**
	 * Require authentication to run.
	 * When set to true, command will exit with an error
	 * if user is not already logged in.
	 */
	public static authenticated = false;

	/**
	 * Require an internet connection to run.
	 * When set to true, command will exit with an error
	 * if user is running in offline mode (BALENARC_OFFLINE_MODE).
	 */
	public static offlineCompatible = false;

	/**
	 * Accept piped input.
	 * When set to true, command will read from stdin during init
	 * and make contents available on member `stdin`.
	 */
	public static readStdin = false;

	public stdin: string;

	/**
	 * Throw InsufficientPrivilegesError if not root on Mac/Linux
	 * or non-Administrator on Windows.
	 *
	 * Called automatically if `root=true`.
	 * Can be called explicitly by command implementation, if e.g.:
	 *  - check should only be done conditionally
	 *  - other code needs to execute before check
	 */
	protected static async checkElevatedPrivileges() {
		const isElevated = await (await import('is-elevated')).default();
		if (!isElevated) {
			throw new InsufficientPrivilegesError(
				'You need root/admin privileges to run this command',
			);
		}
	}

	/**
	 * Throw NotLoggedInError if not logged in.
	 *
	 * Called automatically if `authenticated=true`.
	 * Can be called explicitly by command implementation, if e.g.:
	 *  - check should only be done conditionally
	 *  - other code needs to execute before check
	 *
	 *  Note, currently public to allow use outside of derived commands
	 *  (as some command implementations require this. Can be made protected
	 *  if this changes).
	 *
	 * @throws {NotLoggedInError}
	 */
	public static async checkLoggedIn() {
		await (await import('./utils/patterns.js')).checkLoggedIn();
	}

	/**
	 * Throw NotLoggedInError if not logged in when condition true.
	 *
	 * @param {boolean} doCheck - will check if true.
	 * @throws {NotLoggedInError}
	 */
	public static async checkLoggedInIf(doCheck: boolean) {
		if (doCheck) {
			await this.checkLoggedIn();
		}
	}

	/**
	 * Throw NotAvailableInOfflineModeError if in offline mode.
	 *
	 * Called automatically if `onlineOnly=true`.
	 * Can be called explicitly by command implementation, if e.g.:
	 *  - check should only be done conditionally
	 *  - other code needs to execute before check
	 *
	 *  Note, currently public to allow use outside of derived commands
	 *  (as some command implementations require this. Can be made protected
	 *  if this changes).
	 *
	 * @throws {NotAvailableInOfflineModeError}
	 */
	public static checkNotUsingOfflineMode() {
		if (process.env.BALENARC_OFFLINE_MODE) {
			throw new NotAvailableInOfflineModeError(stripIndent`
		This command requires an internet connection, and cannot be used in offline mode.
		To leave offline mode, unset the BALENARC_OFFLINE_MODE environment variable.
		`);
		}
	}

	/**
	 * Read stdin contents and make available to command.
	 *
	 * This approach could be improved in the future to automatically set argument
	 * values from stdin based in configuration, minimising command implementation.
	 */
	protected async getStdin() {
		const { default: getStdin } = await import('get-stdin');
		this.stdin = await getStdin();
	}

	/**
	 * Get a logger instance.
	 */
	protected static async getLogger() {
		const { default: Logger } = await import('./utils/logger.js');
		return Logger.getLogger();
	}

	protected async init() {
		const ctr = this.constructor as typeof BalenaCommand;

		if (ctr.root) {
			await BalenaCommand.checkElevatedPrivileges();
		}

		if (ctr.authenticated) {
			await BalenaCommand.checkLoggedIn();
		}

		if (!ctr.offlineCompatible) {
			BalenaCommand.checkNotUsingOfflineMode();
		}

		if (ctr.readStdin) {
			await this.getStdin();
		}
	}

	protected outputMessage = output.outputMessage;
	protected outputData = output.outputData;
}
