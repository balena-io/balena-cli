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

import { Args, Command } from '@oclif/core';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationNameNote } from '../../utils/messages';
import * as JSONStream from 'JSONStream';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export default class ReleaseListCmd extends Command {
	public static aliases = ['releases'];
	public static deprecateAliases = true;
	public static enableJsonFlag = true;

	public static description = stripIndent`
		List all releases of a fleet.

		List all releases of the given fleet.

		${applicationNameNote.split('\n').join('\n\t\t')}
`;
	public static examples = ['$ balena release list myorg/myfleet'];

	public static args = {
		fleet: Args.string({
			description: 'fleet name or slug (preferred)',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseListCmd);

		const explicitReadFields = ['raw_version'] as const;
		const fields = [
			'id',
			'commit',
			'created_at',
			'status',
			...explicitReadFields,
			'is_final',
		] as const;
		const fieldNameMap: Partial<Record<(typeof fields)[number], string>> = {
			raw_version: 'version',
		};

		const balena = getBalenaSdk();
		const { getFleetSlug } = await import('../../utils/sdk');

		const slug = await getFleetSlug(balena, params.fleet);
		const releases = await balena.models.release.getAllByApplication(
			slug,
			options.json
				? {
						$expand: {
							release_tag: {
								$select: ['tag_key', 'value'],
							},
						},
					}
				: { $select: fields },
		);

		if (options.json) {
			// We fetch the bC explicit read fields independently, since we want to fetch all fields on both bC & oB
			// but bC & oB have different fields, so we can't enumerate them in a single $select.
			const releasesWithExplicitReadFields =
				await balena.models.release.getAllByApplication(slug, {
					$select: ['id', ...explicitReadFields],
				});
			const _ = await import('lodash');
			const releasesWithExplicitReadFieldsById = _.keyBy(
				releasesWithExplicitReadFields,
				(r) => r.id,
			);

			for (const release of releases) {
				Object.assign(release, releasesWithExplicitReadFieldsById[release.id]);
			}

			await pipeline(
				Readable.from(releases),
				JSONStream.stringify('[', ',', ']\n'),
				new Writable({
					write(chunk, encoding, callback) {
						process.stdout.write(chunk, encoding, callback);
					},
				}),
			);
			return;
		}
		console.log(
			getVisuals().table.horizontal(
				releases.map((rel) =>
					Object.fromEntries(
						Object.entries(rel).map(([f, val]) => [
							fieldNameMap[f as keyof typeof fieldNameMap] ?? f,
							val ?? 'N/a',
						]),
					),
				),
				fields.map((f) => fieldNameMap[f] ?? f),
			),
		);
	}
}
