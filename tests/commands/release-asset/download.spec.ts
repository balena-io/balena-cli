/**
 * @license
 * Copyright 2025 Balena Ltd.
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
import * as fs from 'fs';
import * as nock from 'nock';
import * as path from 'path';
import * as os from 'os';
import { BalenaAPIMock } from '../../nock/balena-api-mock';
import { cleanOutput, runCommand } from '../../helpers';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena release-asset download', function () {
	let api: BalenaAPIMock;
	let tempDir: string;

	beforeEach(async () => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });

		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'balena-test-'));
	});

	afterEach(async () => {
		await fs.promises.rm(tempDir, { recursive: true, force: true });
		api.done();
	});

	itSS('should download a release asset successfully', async () => {
		const testContent = 'test file content for download';

		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: true, assetId: 123 });

		const downloadMock = nock('https://balena-asset-downloads.s3.amazonaws.com')
			.get('/release-asset-123.bin')
			.reply(200, testContent, {
				'content-type': 'application/octet-stream',
				'content-length': testContent.length.toString(),
			});

		const { out, err } = await runCommand(
			`release-asset download 27fda508c --key test-file.txt --output ${path.join(tempDir, 'downloaded-file.txt')}`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('downloaded successfully');
		expect(err).to.be.empty;

		const downloadedContent = await fs.promises.readFile(
			path.join(tempDir, 'downloaded-file.txt'),
			'utf8',
		);
		expect(downloadedContent).to.equal(testContent);

		downloadMock.done();
	});

	itSS(
		'should download asset to current directory when no output specified',
		async () => {
			const testContent = 'test content without output path';

			api.expectGetRelease();
			api.expectGetReleaseAsset({ found: true, assetId: 456 });

			const downloadMock = nock(
				'https://balena-asset-downloads.s3.amazonaws.com',
			)
				.get('/release-asset-456.bin')
				.reply(200, testContent, {
					'content-type': 'application/octet-stream',
					'content-length': testContent.length.toString(),
				});

			const { out, err } = await runCommand(
				`release-asset download 27fda508c --key config.json`,
			);

			const lines = cleanOutput(out);
			expect(lines.join(' ')).to.contain('downloaded successfully');
			expect(err).to.be.empty;

			const downloadedContent = await fs.promises.readFile(
				'config.json',
				'utf8',
			);
			expect(downloadedContent).to.equal(testContent);

			await fs.promises.unlink('config.json');
			downloadMock.done();
		},
	);

	it('should handle asset not found error', async () => {
		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: false });

		const { err } = await runCommand(
			`release-asset download 27fda508c --key nonexistent-file.txt`,
		);

		expect(err.join(' ')).to.contain('not found');
	});

	itSS('should create output directory if it does not exist', async () => {
		const testContent = 'test content for nested directory';
		const outputPath = path.join(tempDir, 'nested', 'dir', 'file.txt');

		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: true, assetId: 789 });

		const downloadMock = nock('https://balena-asset-downloads.s3.amazonaws.com')
			.get('/release-asset-789.bin')
			.reply(200, testContent, {
				'content-type': 'application/octet-stream',
				'content-length': testContent.length.toString(),
			});

		const { out, err } = await runCommand(
			`release-asset download 27fda508c --key test-file.txt --output ${outputPath}`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('downloaded successfully');
		expect(err).to.be.empty;

		const downloadedContent = await fs.promises.readFile(outputPath, 'utf8');
		expect(downloadedContent).to.equal(testContent);

		downloadMock.done();
	});
});
