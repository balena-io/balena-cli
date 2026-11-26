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

import { Args, Command, Flags } from '@oclif/core';
import type { BalenaSDK } from 'balena-sdk';
import { ExpectedError } from '../../errors';
import {
	getBalenaSdk,
	getCliForm,
	getVisuals,
	stripIndent,
} from '../../utils/lazy';

async function getLatestServiceAgreement(balena: BalenaSDK) {
	try {
		const [msa] = await balena.pine.get({
			resource: 'service_agreement',
			options: {
				$top: 1,
				$select: ['id', 'attachment', 'was_published_on__date'],
				$filter: {
					was_published_on__date: { $le: { $now: {} } },
				},
				$orderby: {
					was_published_on__date: 'desc',
				},
			},
		});
		return msa;
	} catch (err) {
		if (
			err.code === balena.errors.BalenaRequestError.prototype.code &&
			err.statusCode === 401
		) {
			// Backends without an MSA model (e.g. openBalena) respond with 401,
			// which we treat as "no MSA defined".
			return;
		}
		throw err;
	}
}

async function resolveMsaAcceptance(
	balena: BalenaSDK,
	acceptMsaFlag: boolean,
): Promise<number | undefined> {
	const msa = await getLatestServiceAgreement(balena);
	if (msa == null) {
		if (acceptMsaFlag) {
			console.log(
				`No Master Service Agreement to accept was found. Skipping.\n`,
			);
		}
		return;
	}

	const formattedPublishedDate = new Date(msa.was_published_on__date)
		.toISOString()
		// Omit the time part, unless there is one defined.
		.replace(/T00:00:00.000Z$/, '');
	if (acceptMsaFlag) {
		console.log(stripIndent`
			Creating the organization by accepting the Master Service Agreement (last updated on ${formattedPublishedDate}).
			${msa.attachment.href}
`);
		console.log('');
		return msa.id;
	}

	if (process.stdin.isTTY) {
		const accepted = await getCliForm().ask<boolean>({
			message: stripIndent`
				Do you accept the Master Service Agreement (last updated on ${formattedPublishedDate})?
				${msa.attachment.href}`,
			type: 'confirm',
			default: false,
		});
		if (accepted) {
			console.log('');
			return msa.id;
		}
	}

	throw new ExpectedError(stripIndent`
		Accepting the Master Service Agreement is required to create an organization.
		Please find the Master Service Agreement (last updated on ${formattedPublishedDate})
		at the following url and re-run the command with the --accept-msa flag to
		confirm that you accept it:
		${msa.attachment.href}`);
}

export default class OrganizationCreateCmd extends Command {
	public static description = stripIndent`
		Create an organization.

		Create a new organization.

		If the balena backend has a Master Service Agreement (MSA) defined, you will be
		asked to accept it interactively. Use the --accept-msa flag to accept it
		non-interactively (e.g. in scripts or CI).
`;

	public static examples = [
		'$ balena organization create MyOrg',
		'$ balena organization create MyOrg --accept-msa',
	];

	public static args = {
		orgName: Args.string({
			description: 'the name to use for the new organization',
			required: true,
		}),
	};

	public static flags = {
		'accept-msa': Flags.boolean({
			description:
				'accept the current Master Service Agreement (MSA), when one is required for creating an organization',
		}),
	};

	public static authenticated = true;

	public async run() {
		const { args: params, flags } = await this.parse(OrganizationCreateCmd);

		const balena = getBalenaSdk();

		const acceptedMsaId = await resolveMsaAcceptance(
			balena,
			flags['accept-msa'],
		);

		const org = await balena.models.organization.create({
			name: params.orgName,
			...(acceptedMsaId != null && {
				accepted_current__service_agreement: acceptedMsaId,
			}),
		});

		console.log(
			getVisuals().table.vertical(org, ['id', 'name', 'handle', 'created_at']),
		);
	}
}
