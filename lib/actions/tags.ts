/*
Copyright 2016-2018 Balena

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

import { ApplicationTag, DeviceTag, ReleaseTag } from 'balena-sdk';
import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';
import { getBalenaSdk, getVisuals } from '../utils/lazy';
import {
	disambiguateReleaseParam,
	normalizeUuidProp,
} from '../utils/normalization';
import * as commandOptions from './command-options';

export const list: CommandDefinition<
	{},
	{
		application?: string;
		device?: string;
		release?: number | string;
		release_raw?: string;
	}
> = {
	signature: 'tags',
	description: 'list all resource tags',
	help: stripIndent`
		Use this command to list all tags for
		a particular application, device or release.

		This command lists all application/device/release tags.

		Example:

			$ balena tags --application MyApp
			$ balena tags --device 7cf02a6
			$ balena tags --release 1234
			$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6
	`,
	options: [
		commandOptions.optionalApplication,
		commandOptions.optionalDevice,
		commandOptions.optionalRelease,
	],
	permission: 'user',
	async action(_params, options) {
		normalizeUuidProp(options, 'device');
		const Bluebird = await import('bluebird');
		const _ = await import('lodash');
		const balena = getBalenaSdk();

		const { exitWithExpectedError } = await import('../utils/patterns');

		return Bluebird.try<ApplicationTag[] | DeviceTag[] | ReleaseTag[]>(
			async () => {
				const wrongParametersError = stripIndent`
				To list resource tags, you must provide exactly one of:

				* An application, with --application <appname>
				* A device, with --device <uuid>
				* A release, with --release <id or commit>

				See the help page for examples:

				  $ balena help tags
			`;

				if (
					_.filter([options.application, options.device, options.release])
						.length !== 1
				) {
					return exitWithExpectedError(wrongParametersError);
				}

				if (options.application) {
					return balena.models.application.tags.getAllByApplication(
						options.application,
					);
				}
				if (options.device) {
					return balena.models.device.tags.getAllByDevice(options.device);
				}
				if (options.release) {
					const releaseParam = await disambiguateReleaseParam(
						balena,
						options.release,
						options.release_raw,
					);
					return balena.models.release.tags.getAllByRelease(releaseParam);
				}

				// return never, so that TS typings are happy
				return exitWithExpectedError(wrongParametersError);
			},
		).tap(function(environmentVariables) {
			if (_.isEmpty(environmentVariables)) {
				exitWithExpectedError('No tags found');
			}

			console.log(
				getVisuals().table.horizontal(environmentVariables, [
					'id',
					'tag_key',
					'value',
				]),
			);
		});
	},
};

export const set: CommandDefinition<
	{
		tagKey: string;
		value?: string;
	},
	{
		application?: string;
		device?: string;
		release?: number | string;
		release_raw: string;
	}
> = {
	signature: 'tag set <tagKey> [value]',
	description: 'set a resource tag',
	help: stripIndent`
		Use this command to set a tag to an application, device or release.

		You can optionally provide a value to be associated with the created
		tag, as an extra argument after the tag key. When the value isn't
		provided, a tag with an empty value is created.

		Examples:

			$ balena tag set mySimpleTag --application MyApp
			$ balena tag set myCompositeTag myTagValue --application MyApp
			$ balena tag set myCompositeTag myTagValue --device 7cf02a6
			$ balena tag set myCompositeTag "my tag value with whitespaces" --device 7cf02a6
			$ balena tag set myCompositeTag myTagValue --release 1234
			$ balena tag set myCompositeTag --release 1234
			$ balena tag set myCompositeTag --release b376b0e544e9429483b656490e5b9443b4349bd6
	`,
	options: [
		commandOptions.optionalApplication,
		commandOptions.optionalDevice,
		commandOptions.optionalRelease,
	],
	permission: 'user',
	async action(params, options) {
		normalizeUuidProp(options, 'device');
		const _ = await import('lodash');
		const balena = getBalenaSdk();

		const { exitWithExpectedError } = await import('../utils/patterns');

		if (_.isEmpty(params.tagKey)) {
			return exitWithExpectedError('No tag key was provided');
		}

		if (
			_.filter([options.application, options.device, options.release])
				.length !== 1
		) {
			return exitWithExpectedError(stripIndent`
					To set a resource tag, you must provide exactly one of:

					* An application, with --application <appname>
					* A device, with --device <uuid>
					* A release, with --release <id or commit>

					See the help page for examples:

					  $ balena help tag set
				`);
		}

		if (params.value == null) {
			params.value = '';
		}

		if (options.application) {
			return balena.models.application.tags.set(
				options.application,
				params.tagKey,
				params.value,
			);
		}
		if (options.device) {
			return balena.models.device.tags.set(
				options.device,
				params.tagKey,
				params.value,
			);
		}
		if (options.release) {
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
				options.release_raw,
			);

			return balena.models.release.tags.set(
				releaseParam,
				params.tagKey,
				params.value,
			);
		}
	},
};

export const remove: CommandDefinition<
	{
		tagKey: string;
	},
	{
		application?: string;
		device?: string;
		release?: number | string;
		release_raw?: string;
	}
> = {
	signature: 'tag rm <tagKey>',
	description: 'remove a resource tag',
	help: stripIndent`
		Use this command to remove a tag from an application, device or release.

		Examples:

			$ balena tag rm myTagKey --application MyApp
			$ balena tag rm myTagKey --device 7cf02a6
			$ balena tag rm myTagKey --release 1234
			$ balena tag rm myTagKey --release b376b0e544e9429483b656490e5b9443b4349bd6
	`,
	options: [
		commandOptions.optionalApplication,
		commandOptions.optionalDevice,
		commandOptions.optionalRelease,
	],
	permission: 'user',
	async action(params, options) {
		const _ = await import('lodash');
		const balena = getBalenaSdk();
		const { exitWithExpectedError } = await import('../utils/patterns');

		if (_.isEmpty(params.tagKey)) {
			return exitWithExpectedError('No tag key was provided');
		}

		if (
			_.filter([options.application, options.device, options.release])
				.length !== 1
		) {
			return exitWithExpectedError(stripIndent`
				To remove a resource tag, you must provide exactly one of:

				* An application, with --application <appname>
				* A device, with --device <uuid>
				* A release, with --release <id or commit>

				See the help page for examples:

					$ balena help tag rm
			`);
		}

		if (options.application) {
			return balena.models.application.tags.remove(
				options.application,
				params.tagKey,
			);
		}
		if (options.device) {
			return balena.models.device.tags.remove(options.device, params.tagKey);
		}
		if (options.release) {
			const releaseParam = await disambiguateReleaseParam(
				balena,
				options.release,
				options.release_raw,
			);

			return balena.models.release.tags.remove(releaseParam, params.tagKey);
		}
	},
};
