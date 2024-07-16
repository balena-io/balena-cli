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
import type { Hook } from '@oclif/core';

let trackResolve: (result: Promise<any>) => void;

// note: trackPromise is subject to a Bluebird.timeout, defined in events.ts
export const trackPromise = new Promise((resolve) => {
	trackResolve = resolve;
});

/**
 * This is an oclif 'prerun' hook. This hook runs after the command line is
 * parsed by oclif, but before the command's run() function is called.
 * See: https://oclif.io/docs/hooks
 *
 * This hook is used to track CLI command signatures (usage analytics).
 * A command signature is something like "env add NAME [VALUE]". That's
 * literally so: 'NAME' and 'VALUE' are NOT replaced with actual values.
 */
const hook: Hook<'prerun'> = async function (options) {
	const events = await import('../../events.js');
	const usage: string | string[] | undefined = options.Command.usage;
	const cmdSignature =
		usage == null ? '*' : typeof usage === 'string' ? usage : usage.join(' ');

	// Intentionally do not await for the track promise here, in order to
	// run the command tracking and the command itself in parallel.
	trackResolve(events.trackCommand(cmdSignature));
};

export default hook;
