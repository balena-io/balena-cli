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
import { ApplicationVariable, DeviceVariable } from 'balena-sdk';
import * as Bluebird from 'bluebird';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';

import { normalizeUuidProp } from '../utils/normalization';
import * as commandOptions from './command-options';

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
		Use this command to list the environment variables of an application
		or device.

		The --config option is used to list "config" variables that configure
		balena features.

		Service-specific variables are not currently supported. The following
		examples list variables that apply to all services in an app or device.

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
		const _ = await import('lodash');
		const balena = (await import('balena-sdk')).fromSharedOptions();
		const visuals = await import('resin-cli-visuals');

		const { exitWithExpectedError } = await import('../utils/patterns');

		return Bluebird.try(function(): Bluebird<
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
		Use this command to remove an environment variable from an application
		or device.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the \`--yes\` boolean option.

		The --device option selects a device instead of an application.

		Service-specific variables are not currently supported. The following
		examples remove variables that apply to all services in an app or device.

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
		Use this command to change the value of an application or device
		enviroment variable.

		The --device option selects a device instead of an application.

		Service-specific variables are not currently supported. The following
		examples modify variables that apply to all services in an app or device.

		Examples:

			$ balena env rename 376 emacs
			$ balena env rename 376 emacs --device
	`,
	permission: 'user',
	options: [commandOptions.booleanDevice],
	async action(params, options, done) {
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
