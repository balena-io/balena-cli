import * as stream from 'node:stream';
import { cleanOutput, runCommand } from '../../helpers';
import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { expect } from 'chai';
import * as mock from 'mock-require';
import * as sinon from 'sinon';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('export fleet content to a file', function () {
	let api: BalenaAPIMock;
	const releaseBundleCreateStub = sinon.stub();

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		mock('@balena/release-bundle', {
			create: releaseBundleCreateStub,
		});
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		mock.stop('@balena/release-bundle');
	});

	itSS('should export a release to a file', async () => {
		api.expectGetWhoAmI();
		api.expectGetRelease();
		releaseBundleCreateStub.resolves(stream.Readable.from('something'));

		const { out, err } = await runCommand(
			'release export badc0ffe -o /tmp/release.tar.gz',
		);

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain(
			'Release badc0ffe has been exported to /tmp/release.tar.gz.',
		);
		expect(err).to.be.empty;
	});

	itSS('should fail if the create throws an error', async () => {
		api.expectGetWhoAmI();
		api.expectGetRelease();
		releaseBundleCreateStub.rejects(
			new Error('Something went wrong creating the bundle'),
		);

		const { err } = await runCommand(
			'release export badc0ffe -o /tmp/release.tar.gz',
		);

		expect(cleanOutput(err, true)).to.include(
			'Release badc0ffe could not be exported: Something went wrong creating the bundle',
		);
	});

	itSS('should parse with application slug and version', async () => {
		api.expectGetWhoAmI();
		api.expectGetRelease();
		api.expectGetApplication();
		releaseBundleCreateStub.resolves(stream.Readable.from('something'));

		const { out, err } = await runCommand(
			'release export org/superApp -o /tmp/release.tar.gz --version 1.2.3+rev1',
		);

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain(
			'Release org/superApp version 1.2.3+rev1 has been exported to /tmp/release.tar.gz.',
		);
		expect(err).to.be.empty;
	});
});
