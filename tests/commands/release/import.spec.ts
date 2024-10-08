import { cleanOutput, runCommand } from '../../helpers';
import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { expect } from 'chai';
import * as mock from 'mock-require';
import * as sinon from 'sinon';
import * as path from 'node:path';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena release import', function () {
	const appCommit = '4c8becf0780ca69d33b638ea8fa163d7';
	const appSlug = 'myOrg/myFleet';
	const releasePath = path.join('tests', 'test-data', 'release.tar');
	let api: BalenaAPIMock;
	const releaseBundleApplyStub = sinon.stub();

	this.beforeEach(async function () {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI();
		mock('@balena/release-bundle', {
			apply: releaseBundleApplyStub,
		});
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
		mock.stop('@balena/release-bundle');
	});

	itSS('should import a release to an app', async () => {
		api.expectGetApplication();
		releaseBundleApplyStub.resolves(123);

		const { out, err } = await runCommand(
			`release import ${releasePath} ${appSlug}`,
		);

		const lines = cleanOutput(out);
		expect(lines[0]).to.contain(
			`Release bundle ${releasePath} has been imported to ${appSlug}.`,
		);
		expect(err).to.be.empty;
	});

	itSS(
		'should import a release to an app with a version override',
		async () => {
			api.expectGetApplication();
			releaseBundleApplyStub.resolves(123);

			const { out, err } = await runCommand(
				`release import ${releasePath} ${appSlug} --override-version 1.2.3`,
			);

			const lines = cleanOutput(out);
			expect(lines[0]).to.contain(
				`Release bundle ${releasePath} has been imported to ${appSlug}.`,
			);
			expect(err).to.be.empty;
		},
	);

	it('should fail if release file does not exist', async () => {
		const nonExistentFile = path.join(
			'tests',
			'test-data',
			'non-existent-file.tar',
		);

		const { out, err } = await runCommand(
			`release import ${nonExistentFile} ${appSlug}`,
		);

		expect(cleanOutput(err, true)).to.contain(
			`Could not import release bundle ${nonExistentFile} to ${appSlug}: ${nonExistentFile} does not exist or is not accessible`,
		);
		expect(out).to.be.empty;
	});

	itSS('should fail if overriding version is not a valid semver', async () => {
		api.expectGetApplication();
		const expectedError = `Manifest is malformed: Expected version to be a valid semantic version but found '${appCommit}'`;
		releaseBundleApplyStub.rejects(new Error(expectedError));

		const { out, err } = await runCommand(
			`release import ${releasePath} ${appSlug} --override-version ${appCommit}`,
		);
		expect(cleanOutput(err, true)).to.contain(
			`Could not import release bundle ${releasePath} to ${appSlug}: ${expectedError}`,
		);
		expect(out).to.be.empty;
	});

	itSS(
		'should fail if a successful release with the same commit already exists',
		async () => {
			api.expectGetApplication();
			const expectedError = `A successful release with commit ${appCommit} (1.2.3) already exists; nothing to do`;
			releaseBundleApplyStub.rejects(new Error(expectedError));

			const { out, err } = await runCommand(
				`release import ${releasePath} ${appSlug}`,
			);

			expect(cleanOutput(err, true)).to.include(
				`Could not import release bundle ${releasePath} to ${appSlug}: ${expectedError}`,
			);
			expect(out).to.be.empty;
		},
	);
});
