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

import { Flags } from '@oclif/core';
import Command from '../../command.js';
import { stripIndent } from '../../utils/lazy.js';

export interface JsonVersions {
	'balena-cli': string;
	'Node.js': string;
}

export default class VersionCmd extends Command {
	public static description = stripIndent`
		Display version information for the balena CLI and/or Node.js.

		Display version information for the balena CLI and/or Node.js. Note that the
		balena CLI executable installers for Windows and macOS, and the standalone
		zip packages, ship with a built-in copy of Node.js.  In this case, the
		reported version of Node.js regards this built-in copy, rather than any
		other \`node\` engine that may also be available on the command prompt.

		The --json option is recommended when scripting the output of this command,
		because the JSON format is less likely to change and it better represents
		data types like lists and empty strings. The 'jq' utility may be helpful
		in shell scripts (https://stedolan.github.io/jq/manual/).

		This command can also be invoked with 'balena --version' or 'balena -v'.
`;
	public static examples = [
		'$ balena version',
		'$ balena version -a',
		'$ balena version -j',
		`$ balena --version`,
		`$ balena -v`,
	];

	public static usage = 'version';

	public static offlineCompatible = true;

	public static flags = {
		all: Flags.boolean({
			default: false,
			char: 'a',
			description:
				'include version information for additional components (Node.js)',
		}),
		json: Flags.boolean({
			default: false,
			char: 'j',
			description:
				'output version information in JSON format for programmatic use',
		}),
		help: Flags.help({ char: 'h' }),
	};

	public async run() {
		const { flags: options } = await this.parse(VersionCmd);
		const versions: JsonVersions = {
			'balena-cli': (
				await import('../../../package.json', { with: { type: 'json' } })
			).default.version,
			'Node.js':
				process.version && process.version.startsWith('v')
					? process.version.slice(1)
					: process.version,
		};
		if (options.json) {
			console.log(JSON.stringify(versions, null, 4));
		} else {
			if (options.all) {
				console.log(`balena-cli version "${versions['balena-cli']}"`);
				console.log(`Node.js version "${versions['Node.js']}"`);
			} else {
				// backwards compatibility
				console.log(versions['balena-cli']);
			}
		}
	}
}
