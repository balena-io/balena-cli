import * as os from 'node:os';
import * as path from 'node:path';
import * as stream from 'node:stream';
import { cleanOutput, runCommand } from '../../helpers';
import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { expect } from 'chai';
import * as mock from 'mock-require';
import * as sinon from 'sinon';
import { promises as fs } from 'node:fs';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena release export', function () {
	const appCommit = 'badc0ffe';
	const appSlug = 'testOrg/testApp';
	const appVersion = '1.2.3+rev1';
	const tmpDir = os.tmpdir();
	const outputPath = path.resolve(tmpDir, 'release.tar');
	let api: BalenaAPIMock;
	let releaseFileBuffer: Buffer;
	const releaseBundleCreateStub = sinon.stub();

	this.beforeEach(async function () {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI();
		releaseFileBuffer = await fs.readFile(
			path.join('tests', 'test-data', 'release.tar'),
		);
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
		api.expectGetRelease();
		releaseBundleCreateStub.resolves(stream.Readable.from(releaseFileBuffer));

		const { out, err } = await runCommand(
			`release export ${appCommit} -o ${outputPath}`,
		);

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain(
			`Release ${appCommit} has been exported to ${outputPath}.`,
		);
		expect(err).to.be.empty;
	});

	itSS('should fail if the create throws an error', async () => {
		api.expectGetRelease();
		const expectedError = `BalenaReleaseNotFound: Release not found: ${appCommit}`;
		releaseBundleCreateStub.rejects(new Error(expectedError));

		const { err } = await runCommand(
			`release export ${appCommit} -o ${outputPath}`,
		);

		expect(cleanOutput(err, true)).to.include(
			`Release ${appCommit} could not be exported: ${expectedError}`,
		);
	});

	itSS('should parse with application slug and version', async () => {
		api.expectGetRelease();
		api.expectGetApplication({ times: 2 });
		releaseBundleCreateStub.resolves(stream.Readable.from(releaseFileBuffer));

		const { out, err } = await runCommand(
			`release export ${appSlug} -o ${outputPath} --version ${appVersion}`,
		);

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain(
			`Release ${appSlug} version ${appVersion} has been exported to ${outputPath}.`,
		);
		expect(err).to.be.empty;
	});

	it('should fail if the app slug is provided without the release version', async () => {
		api.expectGetRelease({ notFound: true });
		const expectedError = `Release not found: ${appSlug}`;

		const { err } = await runCommand(
			`release export ${appSlug} -o ${outputPath}`,
		);

		expect(cleanOutput(err, true)).to.include(
			`Release ${appSlug} could not be exported: ${expectedError}`,
		);
	});

	it('should fail if the semver is invalid', async () => {
		const expectedError = 'version must be valid SemVer';

		const { err } = await runCommand(
			`release export ${appSlug} --version ${appCommit} -o ${outputPath}`,
		);

		expect(cleanOutput(err, true)).to.include(
			`Release ${appSlug} version ${appCommit} could not be exported: ${expectedError}`,
		);
	});
});
