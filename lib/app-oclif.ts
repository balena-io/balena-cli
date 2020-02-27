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

import type { AppOptions } from './preparser';

/**
 * oclif CLI entrypoint
 */
export async function run(command: string[], options: AppOptions) {
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
	try {
		await Promise.all([trackPromise, runPromise]);
	} catch (err) {
		await (await import('./errors')).handleError(err);
	}
}
