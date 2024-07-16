/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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

import { Flags, Args, type Interfaces } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import type * as BalenaSdk from 'balena-sdk';
import jsyaml from 'js-yaml';
import { tryAsInteger } from '../../utils/validation.js';
import { jsonInfo } from '../../utils/messages.js';

export const commitOrIdArg = Args.custom({
	parse: async (commitOrId: string) => tryAsInteger(commitOrId),
});

type FlagsDef = Interfaces.InferredFlags<typeof ReleaseCmd.flags>;

export default class ReleaseCmd extends Command {
	public static description = stripIndent`
		Get info for a release.

		${jsonInfo.split('\n').join('\n\t\t')}
`;
	public static examples = [
		'$ balena release a777f7345fe3d655c1c981aa642e5555',
		'$ balena release 1234567',
		'$ balena release d3f3151f5ad25ca6b070aa4d08296aca --json',
	];

	public static usage = 'release <commitOrId>';

	public static flags = {
		json: cf.json,
		help: cf.help,
		composition: Flags.boolean({
			default: false,
			char: 'c',
			description: 'Return the release composition',
		}),
	};

	public static args = {
		commitOrId: commitOrIdArg({
			description: 'the commit or ID of the release to get information',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseCmd);

		const balena = getBalenaSdk();
		if (options.composition) {
			await this.showComposition(params.commitOrId, balena);
		} else {
			await this.showReleaseInfo(params.commitOrId, balena, options);
		}
	}

	async showComposition(
		commitOrId: string | number,
		balena: BalenaSdk.BalenaSDK,
	) {
		const release = await balena.models.release.get(commitOrId, {
			$select: 'composition',
		});

		console.log(jsyaml.dump(release.composition));
	}

	async showReleaseInfo(
		commitOrId: string | number,
		balena: BalenaSdk.BalenaSDK,
		options: FlagsDef,
	) {
		const fields: Array<keyof BalenaSdk.Release> = [
			'id',
			'commit',
			'created_at',
			'status',
			'semver',
			'is_final',
			'build_log',
			'start_timestamp',
			'end_timestamp',
		];

		const release = await balena.models.release.get(commitOrId, {
			...(!options.json && { $select: fields }),
			$expand: {
				release_tag: {
					$select: ['tag_key', 'value'],
				},
			},
		});

		if (options.json) {
			console.log(JSON.stringify(release, null, 4));
		} else {
			const tagStr = release
				.release_tag!.map((t) => `${t.tag_key}=${t.value}`)
				.join('\n');

			const _ = await import('lodash');
			const values = _.mapValues(
				release,
				(val) => val ?? 'N/a',
			) as Dictionary<string>;
			values['tags'] = tagStr;

			console.log(getVisuals().table.vertical(values, [...fields, 'tags']));
		}
	}
}
