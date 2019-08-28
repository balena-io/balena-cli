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

import { Main } from '@oclif/command';
import { ExitError } from '@oclif/errors';

import { AppOptions } from './app';
import { trackPromise } from './hooks/prerun/track';

class CustomMain extends Main {
	protected _helpOverride(): boolean {
		// Disable oclif's default handler for the 'version' command
		if (['-v', '--version', 'version'].includes(this.argv[0])) {
			return false;
		} else {
			return super._helpOverride();
		}
	}
}

/**
 * oclif CLI entrypoint
 */
export function run(command: string[], options: AppOptions) {
	const runPromise = CustomMain.run(command).then(
		() => {
			if (!options.noFlush) {
				return require('@oclif/command/flush');
			}
		},
		(error: Error) => {
			// oclif sometimes exits with ExitError code 0 (not an error)
			if (error instanceof ExitError && error.oclif.exit === 0) {
				return;
			} else {
				throw error;
			}
		},
	);
	return Promise.all([trackPromise, runPromise]).catch(
		require('./errors').handleError,
	);
}
