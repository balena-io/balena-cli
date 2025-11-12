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
import { ExpectedError } from '../../errors';
import { getBalenaSdk, getCliForm, stripIndent } from '../../utils/lazy';
import {
	formatDuration,
	intervalToDuration,
	isValid,
	parseISO,
} from 'date-fns';

// In days
const durations = [1, 7, 30, 90];

async function isLoggedInWithJwt() {
	const balena = getBalenaSdk();
	try {
		const token = await balena.auth.getToken();
		const { default: jwtDecode } = await import('jwt-decode');
		jwtDecode(token);
		return true;
	} catch {
		return false;
	}
}

export default class GenerateCmd extends Command {
	public static description = stripIndent`
		Generate a new balenaCloud API key.

		Generate a new balenaCloud API key for the current user, with the given
		name. The key will be logged to the console.

		This key can be used to log into the CLI using 'balena login --token <key>',
		or to authenticate requests to the API with an 'Authorization: Bearer <key>' header.
`;
	public static examples = [
		'$ balena api-key generate "Jenkins Key"',
		'$ balena api-key generate "Jenkins Key" 2025-10-30',
		'$ balena api-key generate "Jenkins Key" never',
	];

	public static args = {
		name: Args.string({
			description: 'the API key name',
			required: true,
		}),
		expiryDate: Args.string({
			description:
				'the expiry date of the API key as an ISO date string, or "never" for no expiry',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params } = await this.parse(GenerateCmd);

		let expiryDateResponse: string | number | undefined = params.expiryDate;
		let key;
		try {
			// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
			expiryDateResponse ||= await getCliForm().ask({
				message: 'Please pick an expiry date for the API key',
				type: 'list',
				choices: [...durations, 'custom', 'never'].map((duration) => ({
					name:
						duration === 'never'
							? 'No expiration'
							: typeof duration === 'number'
								? formatDuration(
										intervalToDuration({
											start: 0,
											end: duration * 24 * 60 * 60 * 1000,
										}),
									)
								: 'Custom expiration',
					value: duration,
				})),
			});
			let expiryDate: Date | null;
			if (expiryDateResponse === 'never') {
				expiryDate = null;
			} else if (expiryDateResponse === 'custom') {
				do {
					expiryDate = parseISO(
						await getCliForm().ask({
							message:
								'Please enter an expiry date for the API key as an ISO date string',
							type: 'input',
						}),
					);
					if (!isValid(expiryDate)) {
						console.error('Invalid date format');
					}
				} while (!isValid(expiryDate));
			} else if (typeof expiryDateResponse === 'string') {
				expiryDate = parseISO(expiryDateResponse);
				if (!isValid(expiryDate)) {
					throw new Error(
						'Invalid date format, please use a valid ISO date string',
					);
				}
			} else {
				expiryDate = new Date(
					Date.now() + expiryDateResponse * 24 * 60 * 60 * 1000,
				);
			}
			key = await getBalenaSdk().models.apiKey.create({
				name: params.name,
				expiryDate: expiryDate === null ? null : expiryDate.toISOString(),
			});
		} catch (e) {
			if (e.name === 'BalenaNotLoggedIn') {
				if (await isLoggedInWithJwt()) {
					throw new ExpectedError(stripIndent`
						This command requires you to have been recently authenticated.
						Please login again with 'balena login'.
						In case you are using the Web authorization method, you need to logout and re-login to the dashboard first.
					`);
				}
				throw new ExpectedError(stripIndent`
					This command cannot be run when logged in with an API key.
					Please login again with 'balena login' and select an alternative method.
				`);
			} else {
				throw e;
			}
		}

		console.log(stripIndent`
			Registered api key '${params.name}':

			${key}

			This key will not be shown again, so please save it now.
		`);
	}
}
