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

import { Application } from 'balena-sdk';
import { CommandDefinition } from 'capitano';
import { getBalenaSdk, getVisuals } from '../utils/lazy';
import * as commandOptions from './command-options';

export const create: CommandDefinition<
	{
		name: string;
	},
	{
		type?: string;
	}
> = {
	signature: 'app create <name>',
	description: 'create an application',
	help: `\
Use this command to create a new balena application.

You can specify the application device type with the \`--type\` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ balena devices supported

Examples:

	$ balena app create MyApp
	$ balena app create MyApp --type raspberry-pi\
`,
	options: [
		{
			signature: 'type',
			parameter: 'type',
			description:
				'application device type (Check available types with `balena devices supported`)',
			alias: 't',
		},
	],
	permission: 'user',
	async action(params, options) {
		const balena = getBalenaSdk();

		const patterns = await import('../utils/patterns');

		// Validate the the application name is available
		// before asking the device type.
		// https://github.com/balena-io/balena-cli/issues/30
		return balena.models.application
			.has(params.name)
			.then(hasApplication => {
				if (hasApplication) {
					return patterns.exitWithExpectedError(
						'You already have an application with that name!',
					);
				}
			})
			.then(() => options.type || patterns.selectDeviceType())
			.then(deviceType =>
				balena.models.application.create({
					name: params.name,
					deviceType,
				}),
			)
			.then(application =>
				console.info(
					`Application created: ${application.app_name} (${application.device_type}, id ${application.id})`,
				),
			);
	},
};

export const list: CommandDefinition = {
	signature: 'apps',
	description: 'list all applications',
	help: `\
Use this command to list all your applications.

Notice this command only shows the most important bits of information for each app.
If you want detailed information, use balena app <name> instead.

Examples:

	$ balena apps\
`,
	permission: 'user',
	primary: true,
	async action() {
		const _ = await import('lodash');
		const balena = getBalenaSdk();

		return balena.models.application
			.getAll({
				$select: ['id', 'app_name', 'device_type'],
				$expand: { owns__device: { $select: 'is_online' } },
			})
			.then(
				(
					applications: Array<
						Application & { device_count?: number; online_devices?: number }
					>,
				) => {
					applications.forEach(application => {
						application.device_count = _.size(application.owns__device);
						application.online_devices = _.sumBy(application.owns__device, d =>
							d.is_online === true ? 1 : 0,
						);
					});

					console.log(
						getVisuals().table.horizontal(applications, [
							'id',
							'app_name',
							'device_type',
							'online_devices',
							'device_count',
						]),
					);
				},
			);
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

	$ balena app MyApp\
`,
	permission: 'user',
	primary: true,
	async action(params) {
		return getBalenaSdk()
			.models.application.get(params.name)
			.then(application => {
				console.log(
					getVisuals().table.vertical(application, [
						`$${application.app_name}$`,
						'id',
						'device_type',
						'slug',
						'commit',
					]),
				);
			});
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

	$ balena app restart MyApp\
`,
	permission: 'user',
	async action(params) {
		return getBalenaSdk().models.application.restart(params.name);
	},
};

export const remove: CommandDefinition<
	{ name: string },
	commandOptions.YesOption
> = {
	signature: 'app rm <name>',
	description: 'remove an application',
	help: `\
Use this command to remove a balena application.

Notice this command asks for confirmation interactively.
You can avoid this by passing the \`--yes\` boolean option.

Examples:

	$ balena app rm MyApp
	$ balena app rm MyApp --yes\
`,
	options: [commandOptions.yes],
	permission: 'user',
	async action(params, options) {
		const patterns = await import('../utils/patterns');

		return patterns
			.confirm(
				options.yes ?? false,
				'Are you sure you want to delete the application?',
			)
			.then(() => getBalenaSdk().models.application.remove(params.name));
	},
};
