/**
 * @license
 * Copyright 2016 Balena Ltd.
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

import { flags } from '@oclif/command';
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';
import { applicationNameNote } from '../utils/messages';
import type * as BalenaSdk from 'balena-sdk';
import type { DataSetOutputOptions } from '../framework';

import { isV14 } from '../utils/version';

interface FlagsDef extends DataSetOutputOptions {
	help: void;
}

interface ArgsDef {
	fleet: string;
}

export default class ReleasesCmd extends Command {
	public static description = stripIndent`
		List all releases of a fleet.

		List all releases of the given fleet.

		${applicationNameNote.split('\n').join('\n\t\t')}
`;
	public static examples = ['$ balena releases myorg/myfleet'];

	public static usage = 'releases <fleet>';

	public static flags: flags.Input<FlagsDef> = {
		...(isV14() ? cf.dataOutputFlags : {}),
		help: cf.help,
	};

	public static args = [
		{
			name: 'fleet',
			description: 'fleet name or slug (preferred)',
			required: true,
		},
	];

	public static authenticated = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			ReleasesCmd,
		);

		const fields: Array<keyof BalenaSdk.Release> = [
			'id',
			'commit',
			'created_at',
			'status',
			'semver',
			'is_final',
		];

		const balena = getBalenaSdk();
		const { getFleetSlug } = await import('../utils/sdk');

		const releases = await balena.models.release.getAllByApplication(
			await getFleetSlug(balena, params.fleet),
			{ $select: fields },
		);

		if (isV14()) {
			await this.outputData(releases, fields, {
				displayNullValuesAs: 'N/a',
				...options,
			});
		} else {
			// Old output implementation
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
