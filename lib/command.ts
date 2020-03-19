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

import Command from '@oclif/command';
import { ExpectedError } from './errors';

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

	protected async checkElevatedPrivileges() {
		const root = (this.constructor as typeof BalenaCommand).root;
		if (root) {
			const isElevated = await (await import('is-elevated'))();
			if (!isElevated) {
				throw new ExpectedError(
					'You need admin privileges to run this command',
				);
			}
		}
	}

	protected async init() {
		await this.checkElevatedPrivileges();
	}
}
