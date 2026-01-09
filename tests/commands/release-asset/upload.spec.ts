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
import * as path from 'path';
import * as os from 'os';
import { cleanOutput, runCommand } from '../../helpers';
import { MockHttpServer } from '../../mockserver';

describe('balena release-asset upload', function () {
	let api: MockHttpServer['api'];
	let server: MockHttpServer;
	let tempDir: string;
	let smallFilePath: string;
	let largeFilePath: string;

	before(async () => {
		server = new MockHttpServer();
		api = server.api;
		await server.start();
		await api.expectGetWhoAmI({ optional: true, persist: true });
	});

	after(async () => {
		await server.stop();
	});

	beforeEach(async () => {
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
		await server.assertAllCalled();
	});

	it('should upload a small release asset successfully', async () => {
		await api.expectGetRelease();
		await api.expectGetReleaseAsset({ found: false });
		await api.expectPostReleaseAsset({ assetKey: 'small-file.txt' });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});

	it('should upload a large release asset using multipart upload', async () => {
		await api.expectGetRelease();
		await api.expectGetReleaseAssetMissingOnce();
		await api.expectPostReleaseAsset({
			assetKey: 'large-file.bin',
			assetId: 456,
		});
		await api.expectBeginUpload({ assetId: 456 });

		// Mock the upload part endpoint - use thenCallback to consume request body
		await server.mockttp.forPut('/upload/part1/456').thenCallback(() => {
			return {
				status: 200,
				headers: { ETag: '"test-etag-12345"' },
			};
		});

		await api.expectCommitUpload({ assetId: 456 });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${largeFilePath} --key large-file.bin --debug`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});

	it('should handle asset already exists error when overwrite is false', async () => {
		await api.expectGetRelease();
		await api.expectGetReleaseAsset({ found: true, assetId: 456 });

		const { err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt`,
		);
		expect(err.join(' ')).to.contain('already exists');
	});

	it('should upload small asset when overwrite is true and asset exists', async () => {
		await api.expectGetRelease();
		await api.expectGetReleaseAsset({ found: true, assetId: 456 });
		await api.expectPatchReleaseAsset({ assetId: 456 });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${smallFilePath} --key small-file.txt --overwrite`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});

	it('should upload large asset when overwrite is true and asset exists', async () => {
		await api.expectGetRelease();
		await api.expectGetReleaseAsset({ found: true, assetId: 789 });
		await api.expectBeginUpload({
			assetId: 789,
			uuid: 'test-overwrite-uuid',
			uploadPath: '/upload/overwrite-part1/789',
		});

		await server.mockttp
			.forPut('/upload/overwrite-part1/789')
			.thenCallback(() => {
				return {
					status: 200,
					headers: { ETag: '"test-etag-overwrite"' },
				};
			});

		await api.expectCommitUpload({ assetId: 789 });

		const { out, err } = await runCommand(
			`release-asset upload 27fda508c ${largeFilePath} --key large-file.bin --overwrite --debug`,
		);

		const lines = cleanOutput(out);
		expect(lines.join(' ')).to.contain('uploaded successfully');
		expect(err).to.be.empty;
	});
});
