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

import { Flags, Args, type Interfaces, Command } from '@oclif/core';
import { getVisuals, stripIndent } from '../../utils/lazy';
import * as yaml from 'js-yaml';
import { tryAsInteger } from '../../utils/validation';

export const commitOrIdArg = Args.custom({
	parse: tryAsInteger,
});

type FlagsDef = Interfaces.InferredFlags<typeof ReleaseCmd.flags>;

export default class ReleaseCmd extends Command {
	public static enableJsonFlag = true;

	public static description = stripIndent`
		Get info for a release.
`;
	public static examples = [
		'$ balena release a777f7345fe3d655c1c981aa642e5555',
		'$ balena release 1234567',
	];

	public static flags = {
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

		if (options.composition) {
			await this.showComposition(params.commitOrId);
		} else {
			return await this.showReleaseInfo(params.commitOrId, options);
		}
	}

	async showComposition(commitOrId: string | number) {
		const { getRelease } = await import('../../utils/sdk');
		const release = await getRelease(commitOrId, {
			$select: 'composition',
		});

		console.log(yaml.dump(release.composition));
	}

	async showReleaseInfo(commitOrId: string | number, options: FlagsDef) {
		const fields = [
			'id',
			'commit',
			'created_at',
			'status',
			'raw_version',
			'is_final',
			'build_log',
			'start_timestamp',
			'end_timestamp',
		] as const;
		const explicitReadFields = ['raw_version', 'build_log'] as const;
		const fieldNameMap: Partial<Record<(typeof fields)[number], string>> = {
			raw_version: 'version',
		};

		const { getRelease } = await import('../../utils/sdk');
		const release = await getRelease(commitOrId, {
			...(!options.json && { $select: fields }),
			$expand: {
				release_tag: {
					$select: ['tag_key', 'value'],
				},
			},
		});

		if (options.json) {
			// We fetch the bC explicit read fields independently, since we want to fetch all fields on both bC & oB
			// but bC & oB have different fields, so we can't enumerate them in a single $select.
			const { getRelease } = await import('../../utils/sdk');
			const releaseWithExplicitReadFields = await getRelease(release.id, {
				$select: ['id', ...explicitReadFields],
			});
			Object.assign(release, releaseWithExplicitReadFields);
			return JSON.stringify(release, null, 4);
		}
		const tagStr = release
			.release_tag!.map((t) => `${t.tag_key}=${t.value}`)
			.join('\n');
		const values = Object.fromEntries(
			Object.entries(release).map(([f, val]) => [
				fieldNameMap[f as keyof typeof fieldNameMap] ?? f,
				val ?? 'N/a',
			]),
		);
		values['tags'] = tagStr;

		console.log(
			getVisuals().table.vertical(values, [
				...fields.map((f) => fieldNameMap[f] ?? f),
				'tags',
			]),
		);
	}
}
