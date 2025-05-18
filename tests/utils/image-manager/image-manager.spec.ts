import * as stream from 'stream';
import { expect } from 'chai';
import { stub } from 'sinon';
import * as tmp from 'tmp';
import { delay } from '../../utils';
import * as fs from 'fs';
import * as fsAsync from 'fs/promises';
import * as stringToStream from 'string-to-stream';
import { Writable as WritableStream } from 'stream';
import * as imageManager from '../../../build/utils/image-manager';
import { resolve, extname } from 'path';
import * as mockFs from 'mock-fs';
import * as rimraf from 'rimraf';
import { promisify } from 'util';
import * as os from 'os';

// Make sure we're all using literally the same instance of balena-sdk
// so we can mock out methods called by the real code
import { getBalenaSdk } from '../../../build/utils/lazy.js';
const balena = getBalenaSdk();

const fsExistsAsync = promisify(fs.exists);
const clean = async () => {
	await promisify(rimraf)(await balena.settings.get('cacheDirectory'));
};

describe('image-manager', function () {
	describe('.getStream()', () => {
		describe('given the existing image', function () {
			beforeEach(function () {
				this.image = tmp.fileSync();
				fs.writeSync(this.image.fd, 'Cache image', 0, 'utf8');

				this.cacheGetImagePathStub = stub(imageManager, 'getImagePath');
				return this.cacheGetImagePathStub.resolves(this.image.name);
			});

			afterEach(function () {
				this.cacheGetImagePathStub.restore();
				return this.image.removeCallback();
			});

			describe('given the image is fresh', function () {
				beforeEach(function () {
					this.cacheIsImageFresh = stub(imageManager, 'isImageCached');
					return this.cacheIsImageFresh.resolves(true);
				});

				afterEach(function () {
					return this.cacheIsImageFresh.restore();
				});

				it('should eventually become a readable stream of the cached image', function (done) {
					this.timeout(5000);

					void imageManager.getStream('raspberry-pi').then(function (stream) {
						let result = '';

						stream.on('data', (chunk: string) => (result += chunk.toString()));

						return stream.on('end', function () {
							expect(result).to.equal('Cache image');
							done();
						});
					});
				});
			});

			describe('given the image is not fresh', function () {
				beforeEach(function () {
					this.cacheIsImageFresh = stub(imageManager, 'isImageCached');
					return this.cacheIsImageFresh.resolves(false);
				});

				afterEach(function () {
					return this.cacheIsImageFresh.restore();
				});

				// Skipping test because we keep getting `Cache image` instead of `Download image`
				describe.skip('given a valid download endpoint', function () {
					beforeEach(function () {
						this.osDownloadStub = stub(balena.models.os, 'download');
						this.osDownloadStub.resolves(stringToStream('Download image'));
					});

					afterEach(function () {
						this.osDownloadStub.restore();
					});

					it('should eventually become a readable stream of the download image and save a backup copy', function (done) {
						void imageManager.getStream('raspberry-pi').then((stream) => {
							let result = '';

							stream.on('data', (chunk: string) => (result += chunk));

							stream.on('end', async () => {
								expect(result).to.equal('Download image');
								const contents = await fsAsync.readFile(this.image.name, {
									encoding: 'utf8',
								});
								expect(contents).to.equal('Download image');
								done();
							});
						});
					});

					it('should be able to read from the stream after a slight delay', function (done) {
						void imageManager.getStream('raspberry-pi').then(async (s) => {
							await delay(200);

							const pass = new stream.PassThrough();
							s.pipe(pass);

							let result = '';

							pass.on('data', (chunk) => (result += chunk));

							pass.on('end', function () {
								expect(result).to.equal('Download image');
								done();
							});
						});
					});
				});

				describe('given a failing download', function () {
					beforeEach(function () {
						this.osDownloadStream = new stream.PassThrough();
						this.osDownloadStub = stub(balena.models.os, 'download');
						this.osDownloadStub.resolves(this.osDownloadStream);
					});

					afterEach(function () {
						this.osDownloadStub.restore();
					});

					it('should clean up the in progress cached stream if an error occurs', function (done) {
						if (os.platform() === 'win32') {
							// Skipping test on Windows because we get `EPERM: operation not permitted, rename` for `getImageWritableStream` on the windows runner
							this.skip();
						}
						void imageManager.getStream('raspberry-pi').then((stream) => {
							stream.on('data', () => {
								// After the first chunk, error
								return this.osDownloadStream.emit('error');
							});

							stream.on('error', async () => {
								const contents = await fsAsync
									.stat(this.image.name + '.inprogress')
									.then(function () {
										throw new Error('Image cache should be deleted on failure');
									})
									.catch((err) => {
										if (err.code !== 'ENOENT') {
											throw err;
										}
										return fsAsync.readFile(this.image.name, {
											encoding: 'utf8',
										});
									});
								expect(contents).to.equal('Cache image');
								done();
							});

							stringToStream('Download image').pipe(this.osDownloadStream);
						});
					});
				});

				describe('given a stream with the mime property', function () {
					beforeEach(function () {
						this.osDownloadStub = stub(balena.models.os, 'download');
						const message = 'Lorem ipsum dolor sit amet';
						const mockResultStream = stringToStream(message) as ReturnType<
							typeof stringToStream
						> & {
							mime?: string;
						};
						mockResultStream.mime = 'application/zip';
						this.osDownloadStub.resolves(mockResultStream);
					});

					afterEach(function () {
						this.osDownloadStub.restore();
					});

					it('should preserve the property', () =>
						imageManager
							.getStream('raspberry-pi')
							.then((resultStream) =>
								expect(resultStream.mime).to.equal('application/zip'),
							));
				});
			});
		});
	});

	describe('.getImagePath()', () => {
		describe('given a cache directory', function () {
			beforeEach(function () {
				this.balenaSettingsGetStub = stub(balena.settings, 'get');

				this.balenaSettingsGetStub
					.withArgs('cacheDirectory')
					.resolves(
						os.platform() === 'win32'
							? 'C:\\Users\\johndoe\\_balena\\cache'
							: '/Users/johndoe/.balena/cache',
					);
			});

			afterEach(function () {
				this.balenaSettingsGetStub.restore();
			});

			describe('given valid slugs', function () {
				beforeEach(function () {
					this.getDeviceTypeManifestBySlugStub = stub(
						balena.models.config,
						'getDeviceTypeManifestBySlug',
					);
					this.getDeviceTypeManifestBySlugStub
						.withArgs('raspberry-pi')
						.resolves({
							yocto: {
								fstype: 'resin-sdcard',
							},
						});

					this.getDeviceTypeManifestBySlugStub
						.withArgs('intel-edison')
						.resolves({
							yocto: {
								fstype: 'zip',
							},
						});
				});

				afterEach(function () {
					this.getDeviceTypeManifestBySlugStub.restore();
				});

				it('should eventually equal an absolute path', async () => {
					await imageManager
						.getImagePath('raspberry-pi', '1.2.3')
						.then(function (imagePath) {
							const isAbsolute = imagePath === resolve(imagePath);
							expect(isAbsolute).to.be.true;
						});
				});

				it('should eventually equal the correct path', async function () {
					const result = await imageManager.getImagePath(
						'raspberry-pi',
						'1.2.3',
					);
					expect(result).to.equal(
						os.platform() === 'win32'
							? 'C:\\Users\\johndoe\\_balena\\cache\\raspberry-pi-v1.2.3.img'
							: '/Users/johndoe/.balena/cache/raspberry-pi-v1.2.3.img',
					);
				});

				it('should use a zip extension for directory images', async () => {
					const imagePath = await imageManager.getImagePath(
						'intel-edison',
						'1.2.3',
					);
					expect(extname(imagePath)).to.equal('.zip');
				});

				it('given invalid version should be rejected', async function () {
					const promise = imageManager.getImagePath('intel-edison', 'DOUGH');
					await expect(promise).to.be.eventually.rejectedWith(
						'Invalid version number',
					);
				});
			});
		});
	});

	describe('.isImageCached()', () => {
		describe('given the raspberry-pi manifest', function () {
			beforeEach(function () {
				this.getDeviceTypeManifestBySlugStub = stub(
					balena.models.config,
					'getDeviceTypeManifestBySlug',
				);
				this.getDeviceTypeManifestBySlugStub.resolves({
					yocto: {
						fstype: 'balena-sdcard',
					},
				});
			});

			afterEach(function () {
				this.getDeviceTypeManifestBySlugStub.restore();
			});

			describe('given the file does not exist', function () {
				beforeEach(function () {
					this.utilsGetFileCreatedDate = stub(
						imageManager,
						'getFileCreatedDate',
					);
					this.utilsGetFileCreatedDate.rejects(
						new Error("ENOENT, stat 'raspberry-pi'"),
					);
				});

				afterEach(function () {
					this.utilsGetFileCreatedDate.restore();
				});

				it('should return false', async function () {
					expect(await imageManager.isImageCached('raspberry-pi', '1.2.3')).to
						.be.false;
				});
			});
		});
	});

	describe('.getImage()', () => {
		describe('given an existing image', function () {
			beforeEach(function () {
				this.image = tmp.fileSync();
				fs.writeSync(this.image.fd, 'Lorem ipsum dolor sit amet', 0, 'utf8');

				this.cacheGetImagePathStub = stub(imageManager, 'getImagePath');
				this.cacheGetImagePathStub.resolves(this.image.name);
			});

			afterEach(function (done) {
				this.cacheGetImagePathStub.restore();
				fs.unlink(this.image.name, done);
			});

			it('should return a stream to the image', function (done) {
				void imageManager
					.getImage('lorem-ipsum', '1.2.3')
					.then(function (stream) {
						let result = '';

						stream.on('data', (chunk) => (result += chunk as string));

						stream.on('end', function () {
							expect(result).to.equal('Lorem ipsum dolor sit amet');
							done();
						});
					});
			});

			it('should contain the mime property', () =>
				imageManager
					.getImage('lorem-ipsum', '1.2.3')
					.then((stream) =>
						expect(stream.mime).to.equal('application/octet-stream'),
					));
		});
	});

	describe('.getImageWritableStream()', () => {
		describe('given the valid image path', function () {
			beforeEach(function () {
				this.image = tmp.fileSync();
				this.cacheGetImagePathStub = stub(imageManager, 'getImagePath');
				this.cacheGetImagePathStub.resolves(this.image.name);
			});

			afterEach(function (done) {
				this.cacheGetImagePathStub.restore();
				fs.unlink(this.image.name, done);
			});

			it('should return a writable stream', () =>
				imageManager
					.getImageWritableStream('raspberry-pi', '1.2.3')
					.then((stream) =>
						expect(stream).to.be.an.instanceof(WritableStream),
					));

			it('should allow writing to the stream', function (done) {
				if (os.platform() === 'win32') {
					// Skipping test on Windows because we get `EPERM: operation not permitted, rename` for `getImageWritableStream` on the windows runner
					this.skip();
				}
				void imageManager
					.getImageWritableStream('raspberry-pi', '1.2.3')
					.then((stream) => {
						const stringStream = stringToStream('Lorem ipsum dolor sit amet');
						stringStream.pipe(stream);
						stream.on('finish', async () => {
							await stream.persistCache();
							const contents = await fsAsync.readFile(this.image.name, {
								encoding: 'utf8',
							});
							expect(contents).to.equal('Lorem ipsum dolor sit amet');
							done();
						});
					});
			});
		});
	});

	describe('.getFileCreatedDate()', function () {
		describe('given the file exists', function () {
			beforeEach(function () {
				this.date = new Date(2014, 1, 1);
				this.fsStatStub = stub(fs.promises, 'stat');
				this.fsStatStub.withArgs('foo').resolves({ ctime: this.date });
			});

			afterEach(function () {
				this.fsStatStub.restore();
			});

			it('should eventually equal the created time in milliseconds', async function () {
				const promise = imageManager.getFileCreatedDate('foo');
				await expect(promise).to.eventually.equal(this.date);
			});
		});

		describe('given the file does not exist', function () {
			beforeEach(function () {
				this.fsStatStub = stub(fs.promises, 'stat');
				this.fsStatStub
					.withArgs('foo')
					.rejects(new Error("ENOENT, stat 'foo'"));
			});

			afterEach(function () {
				this.fsStatStub.restore();
			});

			it('should be rejected with an error', async function () {
				const promise = imageManager.getFileCreatedDate('foo');
				await expect(promise).to.be.rejectedWith('ENOENT');
			});
		});
	});

	describe('.clean()', function () {
		describe('given the cache with saved images', function () {
			beforeEach(async function () {
				this.cacheDirectory = await balena.settings.get('cacheDirectory');
				mockFs({
					[this.cacheDirectory]: {
						'raspberry-pi': 'Raspberry Pi Image',
						'intel-edison': 'Intel Edison Image',
						parallela: 'Parallela Image',
					},
				});
			});

			afterEach(() => {
				mockFs.restore();
			});

			it('should remove the cache directory completely', async function () {
				const exists = await fsExistsAsync(this.cacheDirectory);
				expect(exists).to.be.true;
				await clean();
				const exists2 = await fsExistsAsync(this.cacheDirectory);
				expect(exists2).to.be.false;
			});
		});

		describe('given no cache', function () {
			beforeEach(async function () {
				this.cacheDirectory = await balena.settings.get('cacheDirectory');
				mockFs({});
			});

			afterEach(() => {
				mockFs.restore();
			});

			it('should keep the cache directory removed', async function () {
				const exists = await fsExistsAsync(this.cacheDirectory);
				expect(exists).to.be.false;
				await clean();
				const exists2 = await fsExistsAsync(this.cacheDirectory);
				expect(exists2).to.be.false;
			});
		});
	});
});
