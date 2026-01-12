/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import * as settings from 'balena-settings-client';
import * as balenaSettingsStorage from 'balena-settings-storage';
import { expect } from 'chai';
import * as semver from 'semver';
import * as sinon from 'sinon';

const packageJSON =
	require('../package.json') as typeof import('../package.json');
import type { ReleaseTimestampsByVersion } from '../build/deprecation.js';
import { DeprecationChecker } from '../build/deprecation.js';
import { MockHttpServer } from './mockserver.js';
import type { TestOutput } from './helpers.js';
import { runCommand } from './helpers.js';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('DeprecationChecker', function () {
	const sandbox = sinon.createSandbox();
	const now = new Date().getTime();
	const anHourAgo = now - 3600000;
	const currentMajor = semver.major(packageJSON.version, { loose: true });
	const nextMajorVersion = `${currentMajor + 1}.0.0`;
	const dataDirectory = settings.get<string>('dataDirectory');
	const mockStorage = balenaSettingsStorage.getStorage({ dataDirectory });
	let api: MockHttpServer['api'];
	let server: MockHttpServer;
	let checker: DeprecationChecker;
	let getStub: sinon.SinonStub<
		Parameters<typeof mockStorage.get>,
		ReturnType<typeof mockStorage.get>
	>;
	let setStub: sinon.SinonStub<
		Parameters<typeof mockStorage.set>,
		ReturnType<typeof mockStorage.set>
	>;
	let originalUnsupported: string | undefined;

	before(() => {
		// Temporarily undo settings from `tests/config-tests.ts`
		originalUnsupported = process.env.BALENARC_UNSUPPORTED;
		delete process.env.BALENARC_UNSUPPORTED;
	});
	after(() => {
		process.env.BALENARC_UNSUPPORTED = originalUnsupported;
	});

	beforeEach(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
		checker = new DeprecationChecker(packageJSON.version);

		// Stub getStorage to return our mockStorage instance so that stubs work
		sandbox.stub(balenaSettingsStorage, 'getStorage').returns(mockStorage);

		getStub = sandbox.stub(mockStorage, 'get').withArgs(checker.cacheFile);

		setStub = sandbox
			.stub(mockStorage, 'set')
			.withArgs(checker.cacheFile, sinon.match.any);
	});

	afterEach(async () => {
		// Check all expected api calls have been made and clean up.
		sandbox.restore();

		await server.stop();
	});

	itSS(
		'should warn if this version of the CLI is deprecated (isTTY is true)',
		async () => {
			const mockCache: ReleaseTimestampsByVersion = {
				lastFetched: '1970-01-01T00:00:00.000Z',
			};
			// pretend the next major was released just over half a year ago
			mockCache[nextMajorVersion] = new Date(
				checker.now - (checker.deprecationDays + 1) * checker.msInDay,
			).toISOString();

			getStub.resolves(mockCache);

			// Force isTTY to be true. It happens to be false (undefined) when
			// the tests run on balenaCI on Windows.
			const originalIsTTY = process.stderr.isTTY;
			process.stderr.isTTY = true;
			let result: TestOutput;
			try {
				result = await runCommand('version');
			} finally {
				process.stderr.isTTY = originalIsTTY;
			}
			const { out, err } = result;

			expect(setStub.callCount).to.equal(0);
			expect(getStub.callCount).to.equal(1);
			expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

			expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
			expect(err.join('')).to.equal(
				checker.getDeprecationMsg(checker.deprecationDays + 1) + '\n',
			);
		},
	);

	itSS(
		'should NOT warn if this version of the CLI is deprecated (isTTY is false)',
		async () => {
			const mockCache: ReleaseTimestampsByVersion = {
				lastFetched: '1970-01-01T00:00:00.000Z',
			};
			// pretend the next major was released just over half a year ago
			mockCache[nextMajorVersion] = new Date(
				checker.now - (checker.deprecationDays + 1) * checker.msInDay,
			).toISOString();

			getStub.resolves(mockCache);

			// Force isTTY to be false. It happens to be true when
			// the tests run on balenaCI on macOS and Linux.
			const originalIsTTY = process.stderr.isTTY;
			process.stderr.isTTY = false;
			let result: TestOutput;
			try {
				result = await runCommand('version');
			} finally {
				process.stderr.isTTY = originalIsTTY;
			}
			const { out, err } = result;

			expect(setStub.callCount).to.equal(0);
			expect(getStub.callCount).to.equal(1);
			expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

			expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
			expect(err.join('')).to.equal('');
		},
	);

	itSS(
		'should NOT warn with --unsupported (deprecated but not expired)',
		async () => {
			const mockCache: ReleaseTimestampsByVersion = {
				lastFetched: '1970-01-01T00:00:00.000Z',
			};
			// pretend the next major was released just over half a year ago
			mockCache[nextMajorVersion] = new Date(
				checker.now - (checker.deprecationDays + 1) * checker.msInDay,
			).toISOString();

			getStub.resolves(mockCache);

			const { out, err } = await runCommand('version --unsupported');

			expect(setStub.callCount).to.equal(0);
			expect(getStub.callCount).to.equal(0);

			expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
			expect(err.join('')).to.be.empty;
		},
	);

	itSS('should exit if this version of the CLI has expired', async () => {
		const mockCache: ReleaseTimestampsByVersion = {
			lastFetched: '1970-01-01T00:00:00.000Z',
		};
		// pretend the next major was released just over a year ago
		mockCache[nextMajorVersion] = new Date(
			checker.now - (checker.expiryDays + 1) * checker.msInDay,
		).toISOString();

		getStub.resolves(mockCache);

		const { out, err } = await runCommand('version');

		expect(setStub.callCount).to.equal(0);
		expect(getStub.callCount).to.equal(1);
		expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

		expect(out.join('')).to.equal('');
		expect(err.join('')).to.include(
			checker.getExpiryMsg(checker.expiryDays + 1) + '\n\n',
		);
	});

	itSS('should NOT exit with --unsupported (expired version)', async () => {
		const mockCache: ReleaseTimestampsByVersion = {
			lastFetched: '1970-01-01T00:00:00.000Z',
		};
		// pretend the next major was released just over a year ago
		mockCache[nextMajorVersion] = new Date(
			checker.now - (checker.expiryDays + 1) * checker.msInDay,
		).toISOString();

		getStub.resolves(mockCache);

		const { out, err } = await runCommand('--unsupported version');

		expect(setStub.callCount).to.equal(0);
		expect(getStub.callCount).to.equal(0);

		expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
		expect(err.join('')).to.be.empty;
	});

	it('should query the npm registry (empty cache file)', async () => {
		// Mock npm registry response
		await server.mockttp.forGet(`/balena-cli/${nextMajorVersion}`).thenReply(
			200,
			JSON.stringify({
				versionist: { publishedAt: new Date().toISOString() },
			}),
			{ 'Content-Type': 'application/json' },
		);

		getStub.resolves(undefined);

		const { out, err } = await runCommand('version');

		expect(setStub.callCount).to.equal(1);
		expect(setStub.firstCall.args.length).to.equal(2);
		const [name, obj] = setStub.firstCall.args;
		expect(name).to.equal(checker.cacheFile);
		expect(obj).to.have.property(nextMajorVersion);
		const lastFetched = new Date(obj[nextMajorVersion]).getTime();
		expect(lastFetched).to.be.greaterThan(anHourAgo);

		expect(getStub.callCount).to.equal(1);
		expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

		expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
		expect(err.join('')).to.equal('');
	});

	it('should query the npm registry (not recently fetched)', async () => {
		// Mock npm registry response
		await server.mockttp.forGet(`/balena-cli/${nextMajorVersion}`).thenReply(
			200,
			JSON.stringify({
				versionist: { publishedAt: new Date().toISOString() },
			}),
			{ 'Content-Type': 'application/json' },
		);

		const mockCache: ReleaseTimestampsByVersion = {
			lastFetched: new Date(
				checker.now -
					(checker.majorVersionFetchIntervalDays + 1) * checker.msInDay,
			).toISOString(),
		};
		getStub.resolves(mockCache);

		const { out, err } = await runCommand('version');

		expect(setStub.callCount).to.equal(1);
		expect(setStub.firstCall.args.length).to.equal(2);
		const [name, obj] = setStub.firstCall.args;
		expect(name).to.equal(checker.cacheFile);
		expect(obj).to.have.property(nextMajorVersion);
		const lastFetched = new Date(obj[nextMajorVersion]).getTime();
		expect(lastFetched).to.be.greaterThan(anHourAgo);

		expect(getStub.callCount).to.equal(1);
		expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

		expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
		expect(err.join('')).to.equal('');
	});

	itSS('should NOT query the npm registry (recently fetched)', async () => {
		const mockCache: ReleaseTimestampsByVersion = {
			lastFetched: new Date(
				checker.now -
					(checker.majorVersionFetchIntervalDays - 1) * checker.msInDay,
			).toISOString(),
		};
		getStub.resolves(mockCache);

		const { out, err } = await runCommand('version');

		expect(setStub.callCount).to.equal(0);
		expect(getStub.callCount).to.equal(1);
		expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

		expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
		expect(err.join('')).to.equal('');
	});

	itSS('should NOT query the npm registry (cached value)', async () => {
		const mockCache: ReleaseTimestampsByVersion = {
			lastFetched: '1970-01-01T00:00:00.000Z',
		};
		// pretend the next major was released just under half a year ago
		mockCache[nextMajorVersion] = new Date(
			checker.now - (checker.deprecationDays - 1) * checker.msInDay,
		).toISOString();

		getStub.resolves(mockCache);

		const { out, err } = await runCommand('version');

		expect(setStub.callCount).to.equal(0);
		expect(getStub.callCount).to.equal(1);
		expect(getStub.firstCall.args).to.deep.equal([checker.cacheFile]);

		expect(out.join('')).to.include(`balena-cli/${packageJSON.version}`);
		expect(err.join('')).to.equal('');
	});
});
