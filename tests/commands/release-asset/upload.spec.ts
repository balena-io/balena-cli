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

describe('balena release-asset upload', function () {
	let api: BalenaAPIMock;
	let tempDir: string;
	let smallFilePath: string;
	let largeFilePath: string;
	let uploadPartMock: nock.Scope;

	beforeEach(async () => {
		api = new BalenaAPIMock();
		api.expectGetWhoAmI({ optional: true, persist: true });

		tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'balena-test-'));

		// Create a small file (< 5MB)
		smallFilePath = path.join(tempDir, 'small-file.txt');
		const smallContent = Buffer.from('test content for upload');
		await fs.promises.writeFile(smallFilePath, smallContent);

		// Create a large file (> 5MB) to trigger multipart upload
		largeFilePath = path.join(tempDir, 'large-file.bin');
		const largeContent = Buffer.alloc(6 * 1024 * 1024); // 6MB
		await fs.promises.writeFile(largeFilePath, largeContent);
	});

	afterEach(async () => {
		await fs.promises.rm(tempDir, { recursive: true, force: true });
		api.done();
		if (uploadPartMock) {
			uploadPartMock.done();
		}
	});

	it('should upload a small release asset successfully', async () => {
		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: false });
		api.expectPostReleaseAsset({ assetKey: 'small-file.txt' });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});

	itSS(
		'should upload a large release asset using multipart upload',
		async () => {
			api.expectGetRelease();
			api.expectGetReleaseAssetMissingOnce();
			api.expectPostReleaseAsset({ assetKey: 'large-file.bin', assetId: 456 });
			api.expectBeginUpload({ assetId: 456 });

			// Mock the external upload part request
			uploadPartMock = nock('https://test-upload.example.com')
				.put('/part1')
				.reply(200, {}, { ETag: '"test-etag-12345"' });

			api.expectCommitUpload({ assetId: 456 });

			const { out, err } = await runCommand(
				`release-asset upload 27fda508c ${largeFilePath} --key large-file.bin`,
			);

			const lines = cleanOutput(out);
			expect(lines.join(' ')).to.contain('uploaded successfully');
			expect(err).to.be.empty;
		},
	);

	it('should handle asset already exists error when overwrite is false', async () => {
		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: true, assetId: 456 });

		const { err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt`,
		);
		expect(err.join(' ')).to.contain('already exists');
	});

	it('should upload small asset when overwrite is true and asset exists', async () => {
		api.expectGetRelease();
		api.expectGetReleaseAsset({ found: true, assetId: 456 });
		api.expectPatchReleaseAsset({ assetId: 456 });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt --overwrite`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});

	itSS(
		'should upload large asset when overwrite is true and asset exists',
		async () => {
			api.expectGetRelease();
			api.expectGetReleaseAsset({ found: true, assetId: 789 });
			api.expectBeginUpload({
				assetId: 789,
				uuid: 'test-overwrite-uuid',
				uploadUrl: 'https://test-upload.example.com/overwrite-part1',
			});

			// Mock the external upload part request for overwrite
			uploadPartMock = nock('https://test-upload.example.com')
				.put('/overwrite-part1')
				.reply(200, {}, { ETag: '"test-etag-overwrite"' });

			api.expectCommitUpload({ assetId: 789 });

			const { out, err } = await runCommand(
				`release-asset upload 27fda508c ${largeFilePath} --key large-file.bin --overwrite`,
			);

			const lines = cleanOutput(out);
			expect(lines.join(' ')).to.contain('uploaded successfully');
			expect(err).to.be.empty;
		},
	);
});
