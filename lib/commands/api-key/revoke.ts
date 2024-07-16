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

import { Args } from '@oclif/core';
import Command from '../../command.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, stripIndent } from '../../utils/lazy.js';

export default class RevokeCmd extends Command {
	public static description = stripIndent`
		Revoke balenaCloud API keys.

		Revoke balenaCloud API keys with the given
		comma-separated list of ids.

		The given balenaCloud API keys will no longer be usable.
`;
	public static examples = [
		'$ balena api-key revoke 123',
		'$ balena api-key revoke 123,124,456',
	];

	public static args = {
		ids: Args.string({
			description: 'the API key ids',
			required: true,
		}),
	};

	public static usage = 'api-key revoke <ids>';

	public static flags = {
		help: cf.help,
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(RevokeCmd);

		const apiKeyIds = params.ids.split(',');
		if (apiKeyIds.filter((apiKeyId) => !apiKeyId.match(/^\d+$/)).length > 0) {
			console.log('API key ids must be positive integers');
			return;
		}
		await Promise.all(
			apiKeyIds.map(
				async (id) => await getBalenaSdk().models.apiKey.revoke(Number(id)),
			),
		);
		console.log('Successfully revoked the given API keys');
	}
}
