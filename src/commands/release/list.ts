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
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy';
import { applicationNameNote } from '../../utils/messages';
import type * as BalenaSdk from 'balena-sdk';
import { jsonInfo } from '../../utils/messages';
import * as JSONStream from 'JSONStream';
import { Readable, Writable } from 'stream';
import { pipeline } from 'stream/promises';

export default class ReleaseListCmd extends Command {
	public static aliases = ['releases'];
	public static deprecateAliases = true;

	public static description = stripIndent`
		List all releases of a fleet.

		List all releases of the given fleet.

		${applicationNameNote.split('\n').join('\n\t\t')}

		${jsonInfo.split('\n').join('\n\t\t')}
`;
	public static examples = [
		'$ balena release list myorg/myfleet',
		'$ balena release list myorg/myfleet --json',
	];

	public static flags = {
		json: cf.json,
	};

	public static args = {
		fleet: Args.string({
			description: 'fleet name or slug (preferred)',
			required: true,
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = await this.parse(ReleaseListCmd);

		const fields = [
			'id',
			'commit',
			'created_at',
			'status',
			'semver',
			'is_final',
		] satisfies BalenaSdk.PineOptions<BalenaSdk.Release>['$select'];

		const balena = getBalenaSdk();
		const { getFleetSlug } = await import('../../utils/sdk');

		const releases = await balena.models.release.getAllByApplication(
			await getFleetSlug(balena, params.fleet),
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
			await pipeline(
				Readable.from(releases),
				JSONStream.stringify('[', ',', ']\n'),
				new Writable({
					write(chunk, encoding, callback) {
						process.stdout.write(chunk, encoding, callback);
					},
				}),
			);
		} else {
			const _ = await import('lodash');
			console.log(
				getVisuals().table.horizontal(
					releases.map((rel) => _.mapValues(rel, (val) => val ?? 'N/a')),
					fields,
				),
			);
		}
	}
}
