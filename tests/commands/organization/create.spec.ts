/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { expect } from 'chai';
import { cleanOutput, runCommand, stubResinCliFormAsk } from '../../helpers';
import type { ResinCliFormAskStub } from '../../helpers';
import { MockHttpServer } from '../../mockserver';

const MSA_URL = 'https://example.com/msa.pdf';
const msa = {
	id: 5,
	attachment: { href: MSA_URL },
	was_published_on__date: '2025-01-01T00:00:00.000Z',
};

describe('balena organization create', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;
	let originalIsTTY: boolean | undefined;

	before(async () => {
		// Force the non-interactive code path, regardless of how tests are run
		originalIsTTY = process.stdin.isTTY;
		process.stdin.isTTY = false;
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		process.stdin.isTTY = originalIsTTY!;
		await server.stop();
	});

	afterEach(async () => {
		await server.assertAllCalled();
	});

	const getPostedBody = async (
		endpoint: Awaited<ReturnType<typeof api.expectPostOrganization>>,
	) => {
		const [req] = await endpoint.getSeenRequests();
		return (await req.body.getJson()) as Record<string, unknown>;
	};

	it(`should create the organization when the service_agreement model doesn't exist (request fails with 401)`, async () => {
		await api.expectGetServiceAgreement({ status: 401, body: {} });
		const post = await api.expectPostOrganization();

		const { out, err } = await runCommand('organization create MyOrg');

		expect(cleanOutput(out).join(' ')).to.contain('myorg');
		expect(err).to.be.empty;
		expect(await getPostedBody(post)).to.deep.equal({ name: 'MyOrg' });
	});

	it('should create the organization when no MSA is published', async () => {
		await api.expectGetServiceAgreement({ body: { d: [] } });
		const post = await api.expectPostOrganization();

		const { err } = await runCommand('organization create MyOrg');

		expect(err).to.be.empty;
		expect(await getPostedBody(post)).to.deep.equal({ name: 'MyOrg' });
	});

	it(`should create the organization when --accept-msa is provided but the service_agreement model doesn't exist (request fails with 401)`, async () => {
		await api.expectGetServiceAgreement({ status: 401, body: {} });
		const post = await api.expectPostOrganization();

		const { out, err } = await runCommand(
			'organization create MyOrg --accept-msa',
		);

		expect(cleanOutput(out).join(' ')).to.contain('myorg');
		expect(err).to.be.empty;
		expect(await getPostedBody(post)).to.deep.equal({ name: 'MyOrg' });
	});

	it('should create the organization when --accept-msa is provided but no MSA is published', async () => {
		await api.expectGetServiceAgreement({ body: { d: [] } });
		const post = await api.expectPostOrganization();

		const { err } = await runCommand('organization create MyOrg --accept-msa');

		expect(err).to.be.empty;
		expect(await getPostedBody(post)).to.deep.equal({
			name: 'MyOrg',
		});
	});

	it('should accept the MSA when --accept-msa is provided', async () => {
		await api.expectGetServiceAgreement({ body: { d: [msa] } });
		const post = await api.expectPostOrganization();

		const { out, err } = await runCommand(
			'organization create MyOrg --accept-msa',
		);

		expect(err).to.be.empty;
		expect(cleanOutput(out).join(' ')).to.contain(
			'accepting the Master Service Agreement (last updated on 2025-01-01)',
		);
		expect(await getPostedBody(post)).to.deep.equal({
			name: 'MyOrg',
			accepted_current__service_agreement: 5,
		});
	});

	it('should fail without --accept-msa when an MSA is published (non-interactive)', async () => {
		await api.expectGetServiceAgreement({ body: { d: [msa] } });

		const { out, err } = await runCommand('organization create MyOrg');

		expect(out).to.be.empty;
		const errText = cleanOutput(err).join(' ');
		expect(errText).to.contain('is required to create an organization');
		expect(errText).to.contain('(last updated on 2025-01-01)');
		expect(errText).to.contain('--accept-msa');
	});

	// Prompts are stubbed in-process, which isn't possible with the standalone executable
	const describeSS =
		process.env.BALENA_CLI_TEST_TYPE === 'standalone'
			? describe.skip
			: describe;

	describeSS('interactive', function () {
		let askStub: ResinCliFormAskStub;

		beforeEach(() => {
			process.stdin.isTTY = true;
			askStub = stubResinCliFormAsk();
		});

		afterEach(() => {
			process.stdin.isTTY = false;
			askStub.restore();
		});

		it('should accept the MSA when the user confirms the prompt', async () => {
			await api.expectGetServiceAgreement({ body: { d: [msa] } });
			const post = await api.expectPostOrganization();

			askStub.answer('y');
			const { out, err } = await runCommand('organization create MyOrg');

			expect(err).to.be.empty;
			const outText = cleanOutput(out).join(' ');
			expect(outText).to.contain(
				'Do you accept the Master Service Agreement (last updated on 2025-01-01)?',
			);
			expect(outText).to.contain(MSA_URL);
			expect(await getPostedBody(post)).to.deep.equal({
				name: 'MyOrg',
				accepted_current__service_agreement: 5,
			});
		});

		it('should fail when the user declines the prompt', async () => {
			await api.expectGetServiceAgreement({ body: { d: [msa] } });

			askStub.answer('n');
			const { err } = await runCommand('organization create MyOrg');

			expect(cleanOutput(err).join(' ')).to.contain(
				'is required to create an organization',
			);
		});
	});
});
