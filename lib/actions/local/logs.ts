/*
Copyright 2017 Resin.io

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

// A function to reliably execute a command
// in all supported operating systems, including
// different Windows environments like `cmd.exe`
// and `Cygwin` should be encapsulated in a
// re-usable package.
export = <CommandDefinition<
	{
		deviceIp?: string;
	},
	{
		follow: boolean;
		'app-name': string;
	}
>>{
	signature: 'local logs [deviceIp]',
	description:
		'Get or attach to logs of a running container on a resinOS device',
	help: `\

Examples:

	$ resin local logs
	$ resin local logs -f
	$ resin local logs 192.168.1.10
	$ resin local logs 192.168.1.10 -f
	$ resin local logs 192.168.1.10 -f --app-name myapp\
`,
	options: [
		{
			signature: 'follow',
			boolean: true,
			description: 'follow log',
			alias: 'f',
		},
		{
			signature: 'app-name',
			parameter: 'name',
			description: 'name of container to get logs from',
			alias: 'a',
		},
	],
	root: true,
	async action(params, options, done) {
		const { forms } = await import('resin-sync');
		const {
			selectContainerFromDevice,
			pipeContainerStream,
		} = await import('./common');

		let deviceIp =
			params.deviceIp == null
				? await forms.selectLocalResinOsDevice()
				: params.deviceIp;

		let appName =
			options['app-name'] == null
				? await selectContainerFromDevice(deviceIp)
				: options['app-name'];

		pipeContainerStream({
			deviceIp: deviceIp!,
			name: appName,
			outStream: process.stdout,
			follow: options['follow'],
		}).nodeify(done);
	},
};
