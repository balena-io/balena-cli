/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import { promises as fs } from 'fs';

async function writeBinScript() {
	let prefix = process.env['PREFIX'] || '/usr/local';
	prefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
	const binPath = `${prefix}/bin/balena`;
	const libPath = `${prefix}/lib/balena-cli`;
	const binScript = `\
#!/usr/bin/env sh
'${libPath}/node_modules/.bin/node' '${libPath}/bin/balena' "$@"
`;
	console.error(`Writing executable script "${binPath}"`);
	const mode = 0o755;
	await fs.writeFile(binPath, binScript, { mode });
	// Specifying mode in writeFile is not enough if the file
	// already existed, so explicity call chmod too.
	await fs.chmod(binPath, mode);
}

export async function run() {
	await writeBinScript();
	console.error(`\
balena CLI installation complete.

What's next? Try running some commands:

# To print the installed CLI version
$ balena version -a

# To login to balenaCloud and list your apps and devices
$ balena login
$ balena apps
$ balena devices

# To see a list of available commands
$ balena help
$ balena help -v

Thank you for using balena's platform!
`);
}

run();
