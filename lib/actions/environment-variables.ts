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

import * as commandOptions from './command-options';
import { normalizeUuidProp } from '../utils/normalization';
import { DeviceVariable, ApplicationVariable } from 'balena-sdk';
import { stripIndent } from 'common-tags';

const getReservedPrefixes = async (): Promise<string[]> => {
	const balena = (await import('balena-sdk')).fromSharedOptions();
	const settings = await balena.settings.getAll();

	const response = await balena.request.send({
		baseUrl: settings.apiUrl,
		url: '/config/vars',
	});

	return response.body.reservedNamespaces;
};

export const list: CommandDefinition<
	{},
	{
		application?: string;
		device?: string;
		config: boolean;
	}
> = {
	signature: 'envs',
	description: 'list all environment variables',
	help: stripIndent`
		Use this command to list all environment variables for
		a particular application or device.

		This command lists all application/device environment variables.

		If you want to see config variables, used to configure
		balena features, use the --config option.

		At the moment the CLI does not support per-service variables,
		so the following commands will only show service-wide
		environment variables.

		Example:

			$ balena envs --application MyApp
			$ balena envs --application MyApp --config
			$ balena envs --device 7cf02a6
	`,
	options: [
		commandOptions.optionalApplication,
		commandOptions.optionalDevice,

		{
			signature: 'config',
			description: 'show config variables',
			boolean: true,
			alias: ['c', 'v', 'verbose'],
		},
	],
	permission: 'user',
	async action(_params, options, done) {
		normalizeUuidProp(options, 'device');
		const Bluebird = await import('bluebird');
		const _ = await import('lodash');
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const visuals = await import('resin-cli-visuals');

		const { exitWithExpectedError } = await import('../utils/patterns');

		return Bluebird.try(function(): Promise<
			DeviceVariable[] | ApplicationVariable[]
		> {
			if (options.application) {
				return balena.models.application[
					options.config ? 'configVar' : 'envVar'
				].getAllByApplication(options.application);
			} else if (options.device) {
				return balena.models.device[
					options.config ? 'configVar' : 'envVar'
				].getAllByDevice(options.device);
			} else {
				return exitWithExpectedError(
					'You must specify an application or device',
				);
			}
		})
			.tap(function(environmentVariables) {
				if (_.isEmpty(environmentVariables)) {
					exitWithExpectedError('No environment variables found');
				}

				console.log(
					visuals.table.horizontal(environmentVariables, [
						'id',
						'name',
						'value',
					]),
				);
			})
			.nodeify(done);
	},
};

export const remove: CommandDefinition<
	{
		id: number;
	},
	{
		yes: boolean;
		device: boolean;
	}
> = {
	signature: 'env rm <id>',
	description: 'remove an environment variable',
	help: stripIndent`
		Use this command to remove an environment variable from an application.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` boolean option.

		If you want to eliminate a device environment variable, pass the \`--device\` boolean option.

		Examples:

			$ balena env rm 215
			$ balena env rm 215 --yes
			$ balena env rm 215 --device
	`,
	options: [commandOptions.yes, commandOptions.booleanDevice],
	permission: 'user',
	async action(params, options, done) {
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const patterns = await import('../utils/patterns');

		return patterns
			.confirm(
				options.yes,
				'Are you sure you want to delete the environment variable?',
			)
			.then(function() {
				if (options.device) {
					return balena.pine.delete({
						resource: 'device_environment_variable',
						id: params.id,
					});
				} else {
					return balena.pine.delete({
						resource: 'application_environment_variable',
						id: params.id,
					});
				}
			})
			.nodeify(done);
	},
};

export const add: CommandDefinition<
	{
		key: string;
		value?: string;
	},
	{
		application?: string;
		device?: string;
	}
> = {
	signature: 'env add <key> [value]',
	description: 'add an environment or config variable',
	help: stripIndent`
		Use this command to add an enviroment or config variable to an application.

		At the moment the CLI doesn't fully support multi-container applications,
		so the following commands will set service-wide environment variables.

		If value is omitted, the tool will attempt to use the variable's value
		as defined in your host machine.

		Use the \`--device\` option if you want to assign the environment variable
		to a specific device.

		If the value is grabbed from the environment, a warning message will be printed.
		Use \`--quiet\` to remove it.

		Examples:

			$ balena env add EDITOR vim --application MyApp
			$ balena env add TERM --application MyApp
			$ balena env add EDITOR vim --device 7cf02a6
	`,
	options: [commandOptions.optionalApplication, commandOptions.optionalDevice],
	permission: 'user',
	async action(params, options, done) {
		normalizeUuidProp(options, 'device');
		const Bluebird = await import('bluebird');
		const _ = await import('lodash');
		const balena = (await import('balena-sdk')).fromSharedOptions();

		const { exitWithExpectedError } = await import('../utils/patterns');

		return Bluebird.try(async function() {
			if (params.value == null) {
				params.value = process.env[params.key];

				if (params.value == null) {
					throw new Error(`Environment value not found for key: ${params.key}`);
				} else {
					console.info(
						`Warning: using ${params.key}=${
							params.value
						} from host environment`,
					);
				}
			}

			const reservedPrefixes = await getReservedPrefixes();
			const isConfigVar = _.some(reservedPrefixes, prefix =>
				_.startsWith(params.key, prefix),
			);

			if (options.application) {
				return balena.models.application[
					isConfigVar ? 'configVar' : 'envVar'
				].set(options.application, params.key, params.value);
			} else if (options.device) {
				return balena.models.device[isConfigVar ? 'configVar' : 'envVar'].set(
					options.device,
					params.key,
					params.value,
				);
			} else {
				exitWithExpectedError('You must specify an application or device');
			}
		}).nodeify(done);
	},
};

export const rename: CommandDefinition<
	{
		id: number;
		value: string;
	},
	{
		device: boolean;
	}
> = {
	signature: 'env rename <id> <value>',
	description: 'rename an environment variable',
	help: stripIndent`
		Use this command to change the value of an enviroment variable.

		Pass the \`--device\` boolean option if you want to rename a device environment variable.

		Examples:

			$ balena env rename 376 emacs
			$ balena env rename 376 emacs --device
	`,
	permission: 'user',
	options: [commandOptions.booleanDevice],
	async action(params, options, done) {
		const Bluebird = await import('bluebird');
		const balena = (await import('balena-sdk')).fromSharedOptions();

		return Bluebird.try(function() {
			if (options.device) {
				return balena.pine.patch({
					resource: 'device_environment_variable',
					id: params.id,
					body: {
						value: params.value,
					},
				});
			} else {
				return balena.pine.patch({
					resource: 'application_environment_variable',
					id: params.id,
					body: {
						value: params.value,
					},
				});
			}
		}).nodeify(done);
	},
};
