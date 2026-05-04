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

import * as chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

// chai-as-promised exports a function, use default if available
const chaiPlugin =
	'default' in chaiAsPromised
		? (chaiAsPromised as { default: Chai.ChaiPlugin }).default
		: (chaiAsPromised as unknown as Chai.ChaiPlugin);
chai.use(chaiPlugin);
const { expect } = chai;

describe('image validation', function () {
	let tempDir: string;
	let sandbox: sinon.SinonSandbox;

	beforeEach(async function () {
		sandbox = sinon.createSandbox();
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'balena-virt-test-'));
	});

	afterEach(async function () {
		sandbox.restore();
		// Clean up temp directory
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	describe('validateImageExists()', function () {
		let validateImageExists: typeof import('../../../build/utils/virtual-device/image.js').validateImageExists;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			validateImageExists = imageModule.validateImageExists;
		});

		it('should return true for existing file', async function () {
			const imagePath = path.join(tempDir, 'test.img');
			await fs.writeFile(imagePath, 'test content');

			const result = await validateImageExists(imagePath);
			expect(result).to.be.true;
		});

		it('should return false for non-existent file', async function () {
			const imagePath = path.join(tempDir, 'nonexistent.img');

			const result = await validateImageExists(imagePath);
			expect(result).to.be.false;
		});

		it('should return false for directory path', async function () {
			const result = await validateImageExists(tempDir);
			expect(result).to.be.false;
		});
	});

	describe('detectImageFormat()', function () {
		let detectImageFormat: typeof import('../../../build/utils/virtual-device/image.js').detectImageFormat;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			detectImageFormat = imageModule.detectImageFormat;
		});

		it('should detect raw format for .img files', async function () {
			const imagePath = path.join(tempDir, 'test.img');
			// Create a file with minimal raw image content (no magic header = raw)
			await fs.writeFile(imagePath, Buffer.alloc(512));

			const format = await detectImageFormat(imagePath);
			expect(format).to.equal('raw');
		});

		it('should detect gzip format for compressed files', async function () {
			const imagePath = path.join(tempDir, 'test.img.gz');
			// Gzip magic bytes: 1f 8b
			const gzipHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
			await fs.writeFile(imagePath, gzipHeader);

			const format = await detectImageFormat(imagePath);
			expect(format).to.equal('gzip');
		});

		it('should detect zip format for zip files', async function () {
			const imagePath = path.join(tempDir, 'test.zip');
			// ZIP magic bytes: 50 4b 03 04
			const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
			await fs.writeFile(imagePath, zipHeader);

			const format = await detectImageFormat(imagePath);
			expect(format).to.equal('zip');
		});

		it('should throw for non-existent file', async function () {
			const imagePath = path.join(tempDir, 'nonexistent.img');

			await expect(detectImageFormat(imagePath)).to.be.rejectedWith(
				/ENOENT|no such file/i,
			);
		});
	});

	describe('validateImageFormat()', function () {
		let validateImageFormat: typeof import('../../../build/utils/virtual-device/image.js').validateImageFormat;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			validateImageFormat = imageModule.validateImageFormat;
		});

		it('should pass validation for raw format', async function () {
			const imagePath = path.join(tempDir, 'test.img');
			await fs.writeFile(imagePath, Buffer.alloc(512));

			// Should not throw
			await validateImageFormat(imagePath);
		});

		it('should throw for gzip format with helpful message', async function () {
			const imagePath = path.join(tempDir, 'test.img.gz');
			const gzipHeader = Buffer.from([0x1f, 0x8b, 0x08, 0x00]);
			await fs.writeFile(imagePath, gzipHeader);

			await expect(validateImageFormat(imagePath)).to.be.rejectedWith(
				/compressed.*decompress|gzip/i,
			);
		});

		it('should throw for zip format with helpful message', async function () {
			const imagePath = path.join(tempDir, 'test.zip');
			const zipHeader = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
			await fs.writeFile(imagePath, zipHeader);

			await expect(validateImageFormat(imagePath)).to.be.rejectedWith(
				/compressed.*decompress|zip/i,
			);
		});
	});

	describe('createWorkingCopy()', function () {
		let createWorkingCopy: typeof import('../../../build/utils/virtual-device/image.js').createWorkingCopy;
		let getCacheDirectory: () => Promise<string>;
		let originalImagePath: string;
		let cacheDir: string;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			createWorkingCopy = imageModule.createWorkingCopy;
			getCacheDirectory = imageModule.getCacheDirectory;

			// Create a test image
			originalImagePath = path.join(tempDir, 'original.img');
			await fs.writeFile(originalImagePath, 'original image content');

			// Get the cache directory for verification
			cacheDir = await getCacheDirectory();
		});

		afterEach(async function () {
			// Clean up any working copies created in cache directory
			try {
				const files = await fs.readdir(cacheDir);
				for (const file of files) {
					if (file.startsWith('virt-working-')) {
						await fs.rm(path.join(cacheDir, file), { force: true });
					}
				}
			} catch {
				// Cache directory might not exist in test environment
			}
		});

		it('should create a copy in the cache directory', async function () {
			const workingPath = await createWorkingCopy(originalImagePath);

			expect(workingPath).to.include(cacheDir);
			expect(await fs.stat(workingPath)).to.exist;
		});

		it('should preserve original file content', async function () {
			const workingPath = await createWorkingCopy(originalImagePath);

			const originalContent = await fs.readFile(originalImagePath, 'utf8');
			const copyContent = await fs.readFile(workingPath, 'utf8');

			expect(copyContent).to.equal(originalContent);
		});

		it('should not modify original file', async function () {
			const originalContent = await fs.readFile(originalImagePath, 'utf8');
			const originalStat = await fs.stat(originalImagePath);

			const workingPath = await createWorkingCopy(originalImagePath);

			// Modify the working copy
			await fs.appendFile(workingPath, 'modified');

			// Verify original is unchanged
			const afterContent = await fs.readFile(originalImagePath, 'utf8');
			const afterStat = await fs.stat(originalImagePath);

			expect(afterContent).to.equal(originalContent);
			expect(afterStat.size).to.equal(originalStat.size);
		});

		it('should include timestamp in working copy name', async function () {
			const workingPath = await createWorkingCopy(originalImagePath);
			const basename = path.basename(workingPath);

			// Should have format: virt-working-{timestamp}-{original-name}
			expect(basename).to.match(/^virt-working-\d+-/);
		});

		it('should throw for non-existent source file', async function () {
			const nonExistent = path.join(tempDir, 'nonexistent.img');

			await expect(createWorkingCopy(nonExistent)).to.be.rejectedWith(
				/ENOENT|no such file|not found/i,
			);
		});
	});

	describe('parseSizeString()', function () {
		let parseSizeString: typeof import('../../../build/utils/virtual-device/image.js').parseSizeString;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			parseSizeString = imageModule.parseSizeString;
		});

		it('should parse bytes without suffix', function () {
			expect(parseSizeString('1024')).to.equal(1024);
		});

		it('should parse kilobytes (K)', function () {
			expect(parseSizeString('1K')).to.equal(1024);
			expect(parseSizeString('2K')).to.equal(2048);
		});

		it('should parse kilobytes (KB)', function () {
			expect(parseSizeString('1KB')).to.equal(1024);
		});

		it('should parse megabytes (M)', function () {
			expect(parseSizeString('1M')).to.equal(1024 * 1024);
			expect(parseSizeString('512M')).to.equal(512 * 1024 * 1024);
		});

		it('should parse megabytes (MB)', function () {
			expect(parseSizeString('1MB')).to.equal(1024 * 1024);
		});

		it('should parse gigabytes (G)', function () {
			expect(parseSizeString('1G')).to.equal(1024 * 1024 * 1024);
			expect(parseSizeString('8G')).to.equal(8 * 1024 * 1024 * 1024);
		});

		it('should parse gigabytes (GB)', function () {
			expect(parseSizeString('1GB')).to.equal(1024 * 1024 * 1024);
		});

		it('should parse terabytes (T)', function () {
			expect(parseSizeString('1T')).to.equal(1024 * 1024 * 1024 * 1024);
		});

		it('should be case insensitive', function () {
			expect(parseSizeString('8g')).to.equal(parseSizeString('8G'));
			expect(parseSizeString('8gb')).to.equal(parseSizeString('8GB'));
			expect(parseSizeString('1m')).to.equal(parseSizeString('1M'));
		});

		it('should handle decimal values', function () {
			expect(parseSizeString('1.5G')).to.equal(
				Math.floor(1.5 * 1024 * 1024 * 1024),
			);
		});

		it('should handle whitespace', function () {
			expect(parseSizeString('  8G  ')).to.equal(8 * 1024 * 1024 * 1024);
		});

		it('should throw for invalid format', function () {
			expect(() => parseSizeString('abc')).to.throw(/invalid size format/i);
			expect(() => parseSizeString('')).to.throw(/invalid size format/i);
			expect(() => parseSizeString('8X')).to.throw(/invalid size format/i);
		});
	});

	describe('getFileSize()', function () {
		let getFileSize: typeof import('../../../build/utils/virtual-device/image.js').getFileSize;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			getFileSize = imageModule.getFileSize;
		});

		it('should return correct size for existing file', async function () {
			const imagePath = path.join(tempDir, 'sized.img');
			const content = 'test content here';
			await fs.writeFile(imagePath, content);

			const size = await getFileSize(imagePath);
			expect(size).to.equal(content.length);
		});

		it('should throw for non-existent file', async function () {
			const imagePath = path.join(tempDir, 'nonexistent.img');

			await expect(getFileSize(imagePath)).to.be.rejectedWith(
				/ENOENT|no such file/i,
			);
		});
	});

	describe('removeWorkingCopy()', function () {
		let removeWorkingCopy: typeof import('../../../build/utils/virtual-device/image.js').removeWorkingCopy;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			removeWorkingCopy = imageModule.removeWorkingCopy;
		});

		it('should remove existing file', async function () {
			const filePath = path.join(tempDir, 'to-remove.img');
			await fs.writeFile(filePath, 'content');

			await removeWorkingCopy(filePath);

			// File should no longer exist
			await expect(fs.stat(filePath)).to.be.rejectedWith(/ENOENT/);
		});

		it('should not throw for non-existent file', async function () {
			const filePath = path.join(tempDir, 'already-removed.img');

			// Should not throw
			await removeWorkingCopy(filePath);
		});
	});

	describe('detectFlasherImage()', function () {
		let detectFlasherImage: typeof import('../../../build/utils/virtual-device/image.js').detectFlasherImage;
		// Tests run from repo root, so use relative path from there
		const TEST_DATA_DIR = path.join(
			process.cwd(),
			'tests/test-data/virtual-device',
		);

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			detectFlasherImage = imageModule.detectFlasherImage;
		});

		it('should throw for non-existent files', async function () {
			const imagePath = path.join(tempDir, 'nonexistent.img');

			await expect(detectFlasherImage(imagePath)).to.be.rejectedWith(
				/ENOENT|no such file/i,
			);
		});

		it('should handle empty/invalid images gracefully (throw or return isFlasher=false)', async function () {
			// Create temp file with just zeros (no valid partition table)
			// The behavior depends on how partitioninfo handles invalid images
			const imagePath = path.join(tempDir, 'empty.img');
			await fs.writeFile(imagePath, Buffer.alloc(1024));

			try {
				const result = await detectFlasherImage(imagePath);
				// If it doesn't throw, it should indicate disk-image
				expect(result.isFlasher).to.be.false;
				expect(result.innerImageName).to.be.undefined;
			} catch (err) {
				// It's acceptable to throw on invalid images
				expect(err).to.be.an('error');
			}
		});

		it('should return isFlasher=true for installation-media images with .balenaos-img', async function () {
			const imagePath = path.join(TEST_DATA_DIR, 'flasher-test.img');

			const result = await detectFlasherImage(imagePath);

			expect(result.isFlasher).to.be.true;
			expect(result.innerImageName).to.equal('test.balenaos-img');
		});

		it('should return isFlasher=false for disk-images without .balenaos-img', async function () {
			const imagePath = path.join(TEST_DATA_DIR, 'non-flasher-test.img');

			const result = await detectFlasherImage(imagePath);

			expect(result.isFlasher).to.be.false;
			expect(result.innerImageName).to.be.undefined;
		});
	});

	describe('expandImage()', function () {
		let expandImage: typeof import('../../../build/utils/virtual-device/image.js').expandImage;

		beforeEach(async function () {
			const imageModule = await import(
				'../../../build/utils/virtual-device/image.js'
			);
			expandImage = imageModule.expandImage;
		});

		it('should skip expansion when image is already large enough', async function () {
			const imagePath = path.join(tempDir, 'large.img');
			// Create a 1MB file
			await fs.writeFile(imagePath, Buffer.alloc(1024 * 1024));

			const result = await expandImage({
				imagePath,
				targetSize: '512K',
			});

			expect(result.expanded).to.be.false;
			expect(result.finalSize).to.equal(1024 * 1024);
			expect(result.message).to.include('skipping');
		});

		it('should throw for non-existent image', async function () {
			await expect(
				expandImage({
					imagePath: path.join(tempDir, 'missing.img'),
					targetSize: '8G',
				}),
			).to.be.rejectedWith(/not found/i);
		});
	});
});
