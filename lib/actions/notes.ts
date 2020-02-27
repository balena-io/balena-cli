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

import { CommandDefinition } from 'capitano';
import { getBalenaSdk } from '../utils/lazy';

export const set: CommandDefinition<{ note: string }, { device: string }> = {
	signature: 'note <|note>',
	description: 'set a device note',
	help: `\
Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from \`stdin\`.

To view the notes, use $ balena device <uuid>.

Examples:

	$ balena note "My useful note" --device 7cf02a6
	$ cat note.txt | balena note --device 7cf02a6\
`,
	options: [
		{
			signature: 'device',
			parameter: 'device',
			description: 'device uuid',
			alias: ['d', 'dev'],
			required: 'You have to specify a device',
		},
	],
	permission: 'user',
	async action(params, options) {
		const { normalizeUuidProp } = await import('../utils/normalization');
		normalizeUuidProp(options, 'device');
		const _ = await import('lodash');
		const balena = getBalenaSdk();

		if (_.isEmpty(params.note)) {
			const { exitWithExpectedError } = await import('../utils/patterns');
			exitWithExpectedError('Missing note content');
		}

		return balena.models.device.note(options.device!, params.note);
	},
};
