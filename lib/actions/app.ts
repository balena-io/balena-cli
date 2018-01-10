/*
Copyright 2016-2017 Resin.io

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

import * as commandOptions from './command-options';
import { CommandDefinition } from 'capitano';

export const create: CommandDefinition<
	{
		name: string;
	},
	{
		type: string;
	}
> = {
	signature: 'app create <name>',
	description: 'create an application',
	help: `\
Use this command to create a new resin.io application.

You can specify the application device type with the \`--type\` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ resin devices supported

Examples:

	$ resin app create MyApp
	$ resin app create MyApp --type raspberry-pi\
`,
	options: [
		{
			signature: 'type',
			parameter: 'type',
			description:
				'application device type (Check available types with `resin devices supported`)',
			alias: 't',
		},
	],
	permission: 'user',
	async action(params, options, done) {
		const { resin } = await import('../sdk');
		const patterns = await import('../utils/patterns');

		// Validate the the application name is available
		// before asking the device type.
		// https://github.com/resin-io/resin-cli/issues/30
		resin.models.application
			.has(params.name)
			.then(hasApplication => {
				if (hasApplication) {
					throw new Error('You already have an application with that name!');
				}
			})
			.then(() => options.type || patterns.selectDeviceType())
			.then(deviceType =>
				resin.models.application.create(params.name, deviceType),
			)
			.then(application =>
				console.info(
					`Application created: ${application.app_name} (${
						application.device_type
					}, id ${application.id})`,
				),
			)
			.nodeify(done);
	},
};

export const list: CommandDefinition = {
	signature: 'apps',
	description: 'list all applications',
	help: `\
Use this command to list all your applications.

Notice this command only shows the most important bits of information for each app.
If you want detailed information, use resin app <name> instead.

Examples:

	$ resin apps\
`,
	permission: 'user',
	primary: true,
	async action(_params, _options, done) {
		const _ = await import('lodash');
		const { resin } = await import('../sdk');
		const visuals = await import('resin-cli-visuals');

		const applications = await resin.models.application.getAll({
			expand: {
				owns__device: { $select: ['id', 'is_online'] },
			},
		});

		console.log(
			visuals.table.horizontal(
				applications.map(app =>
					_.assign(app, {
						devices_length: app.owns__device!.length,
						online_devices: app.owns__device!.filter(d => d.is_online === true)
							.length,
					}),
				),
				['id', 'app_name', 'device_type', 'online_devices', 'devices_length'],
			),
		);

		done();
	},
};

export const info: CommandDefinition<{
	name: string;
}> = {
	signature: 'app <name>',
	description: 'list a single application',
	help: `\
Use this command to show detailed information for a single application.

Examples:

	$ resin app MyApp\
`,
	permission: 'user',
	primary: true,
	async action(params, _options, done) {
		const { resin } = await import('../sdk');
		const visuals = await import('resin-cli-visuals');

		resin.models.application
			.get(params.name)
			.then(application =>
				console.log(
					visuals.table.vertical(application, [
						`$${application.app_name}$`,
						'id',
						'device_type',
						'git_repository',
						'commit',
					]),
				),
			)
			.nodeify(done);
	},
};

export const restart: CommandDefinition<{
	name: string;
}> = {
	signature: 'app restart <name>',
	description: 'restart an application',
	help: `\
Use this command to restart all devices that belongs to a certain application.

Examples:

	$ resin app restart MyApp\
`,
	permission: 'user',
	async action(params, _options, done) {
		const { resin } = await import('../sdk');
		resin.models.application.restart(params.name).nodeify(done);
	},
};

export const remove: CommandDefinition<
	{
		name: string;
	},
	{
		yes: boolean;
	}
> = {
	signature: 'app rm <name>',
	description: 'remove an application',
	help: `\
Use this command to remove a resin.io application.

Notice this command asks for confirmation interactively.
You can avoid this by passing the \`--yes\` boolean option.

Examples:

	$ resin app rm MyApp
	$ resin app rm MyApp --yes\
`,
	options: [commandOptions.yes],
	permission: 'user',
	async action(params, options, done) {
		const { resin } = await import('../sdk');
		const patterns = await import('../utils/patterns');

		patterns
			.confirm(options.yes, 'Are you sure you want to delete the application?')
			.then(() => resin.models.application.remove(params.name))
			.nodeify(done);
	},
};
