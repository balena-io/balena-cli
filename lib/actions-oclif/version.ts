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

import { Command, flags } from '@oclif/command';
import { stripIndent } from 'common-tags';

interface FlagsDef {
	all?: boolean;
	json?: boolean;
}

export default class VersionCmd extends Command {
	public static description = stripIndent`
		Display version information for the balena CLI and/or Node.js.

		Display version information for the balena CLI and/or Node.js.
		If you intend to parse the output, please use the -j option for
		JSON output, as its format is more stable.
`;
	public static examples = [
		'$ balena version',
		'$ balena version -a',
		'$ balena version -j',
	];

	public static usage = 'version';

	public static flags = {
		all: flags.boolean({
			char: 'a',
			default: false,
			description:
				'include version information for additional components (Node.js)',
		}),
		json: flags.boolean({
			char: 'j',
			default: false,
			description:
				'output version information in JSON format for programmatic use',
		}),
		help: flags.help({ char: 'h' }),
	};

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(VersionCmd);
		const versions = {
			'balena-cli': (await import('../../package.json')).version,
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
