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

// chai-as-promised exports a function, use default if available
const chaiPlugin =
	'default' in chaiAsPromised
		? (chaiAsPromised as { default: Chai.ChaiPlugin }).default
		: (chaiAsPromised as unknown as Chai.ChaiPlugin);
chai.use(chaiPlugin);
const { expect } = chai;

describe('docker utilities', function () {
	let sandbox: sinon.SinonSandbox;

	beforeEach(function () {
		sandbox = sinon.createSandbox();
	});

	afterEach(function () {
		sandbox.restore();
	});

	describe('buildDockerImage()', function () {
		let buildDockerImage: typeof import('../../../build/utils/virtual-device/docker.js').buildDockerImage;
		let mockBuildImage: sinon.SinonStub;
		let mockFollowProgress: sinon.SinonStub;
		let mockImageInspect: sinon.SinonStub;
		let mockDockerClient: {
			buildImage: sinon.SinonStub;
			getImage: sinon.SinonStub;
			modem: { followProgress: sinon.SinonStub };
		};

		beforeEach(async function () {
			// Import the module fresh for each test
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			buildDockerImage = dockerModule.buildDockerImage;

			// Set up mock Docker client
			mockBuildImage = sandbox.stub().resolves({
				pipe: sandbox.stub().returnsThis(),
				on: sandbox.stub().returnsThis(),
			});

			mockFollowProgress = sandbox
				.stub()
				.callsFake(
					(
						_stream: NodeJS.ReadableStream,
						onFinished: (err: Error | null, output: unknown[]) => void,
					) => {
						// Simulate successful build
						setImmediate(() => {
							onFinished(null, [{ stream: 'Successfully built abc123' }]);
						});
					},
				);

			mockImageInspect = sandbox
				.stub()
				.resolves({ Id: 'sha256:existingimage' });

			mockDockerClient = {
				buildImage: mockBuildImage,
				getImage: sandbox.stub().returns({
					inspect: mockImageInspect,
				}),
				modem: {
					followProgress: mockFollowProgress,
				},
			};
		});

		it('should always run docker build even when image exists', async function () {
			// Image exists
			mockImageInspect.resolves({ Id: 'sha256:existingimage' });

			// Pass mock docker client via dependency injection
			await buildDockerImage({ docker: mockDockerClient as never });

			// Verify docker build was called
			expect(mockBuildImage.calledOnce).to.be.true;
		});

		it('should run docker build when image does not exist', async function () {
			// Image does not exist
			mockImageInspect.rejects(new Error('No such image'));

			await buildDockerImage({ docker: mockDockerClient as never });

			// Verify docker build was called
			expect(mockBuildImage.calledOnce).to.be.true;
		});

		it('should return the image name on successful build', async function () {
			const result = await buildDockerImage({
				docker: mockDockerClient as never,
			});

			expect(result).to.equal('balena-qemu-runner');
		});

		it('should pass correct options to docker build', async function () {
			await buildDockerImage({ docker: mockDockerClient as never });

			expect(mockBuildImage.calledOnce).to.be.true;
			const buildOptions = mockBuildImage.firstCall.args[1];
			expect(buildOptions).to.have.property('t', 'balena-qemu-runner');
		});

		it('should propagate build errors', async function () {
			mockFollowProgress.callsFake(
				(
					_stream: NodeJS.ReadableStream,
					onFinished: (err: unknown, output: unknown[]) => void,
				) => {
					setImmediate(() => {
						onFinished(new Error('Build failed'), []);
					});
				},
			);

			await expect(
				buildDockerImage({ docker: mockDockerClient as never }),
			).to.be.rejectedWith('Build failed');
		});

		it('should handle errors in build output', async function () {
			mockFollowProgress.callsFake(
				(
					_stream: NodeJS.ReadableStream,
					onFinished: (err: unknown, output: unknown[]) => void,
				) => {
					setImmediate(() => {
						onFinished(null, [{ error: 'Dockerfile parse error' }]);
					});
				},
			);

			await expect(
				buildDockerImage({ docker: mockDockerClient as never }),
			).to.be.rejectedWith('Dockerfile parse error');
		});
	});

	describe('imageExists()', function () {
		let imageExists: typeof import('../../../build/utils/virtual-device/docker.js').imageExists;
		let mockImageInspect: sinon.SinonStub;
		let mockDockerClient: {
			getImage: sinon.SinonStub;
		};

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			imageExists = dockerModule.imageExists;

			mockImageInspect = sandbox.stub();

			mockDockerClient = {
				getImage: sandbox.stub().returns({
					inspect: mockImageInspect,
				}),
			};
		});

		it('should return true when image exists', async function () {
			mockImageInspect.resolves({ Id: 'sha256:abc123' });

			const result = await imageExists(mockDockerClient as never);
			expect(result).to.be.true;
		});

		it('should return false when image does not exist', async function () {
			mockImageInspect.rejects(new Error('No such image'));

			const result = await imageExists(mockDockerClient as never);
			expect(result).to.be.false;
		});
	});

	describe('listContainers()', function () {
		let listContainers: typeof import('../../../build/utils/virtual-device/docker.js').listContainers;
		let mockListContainers: sinon.SinonStub;
		let mockInspect: sinon.SinonStub;
		let mockDockerClient: {
			listContainers: sinon.SinonStub;
			getContainer: sinon.SinonStub;
		};

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			listContainers = dockerModule.listContainers;

			mockInspect = sandbox.stub();

			mockListContainers = sandbox.stub();

			mockDockerClient = {
				listContainers: mockListContainers,
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
				}),
			};
		});

		it('should return empty array when no containers exist', async function () {
			mockListContainers.resolves([]);

			const result = await listContainers(mockDockerClient as never);
			expect(result).to.be.an('array');
			expect(result).to.have.length(0);
		});

		it('should filter containers by balenaos-vm prefix', async function () {
			mockListContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'] },
				{ Id: 'def456', Names: ['/other-container'] },
			]);

			// Mock inspection results
			mockInspect
				.onFirstCall()
				.resolves({
					State: { Status: 'running' },
					Created: '2024-01-01T00:00:00.000Z',
					Config: { Env: [] },
					NetworkSettings: { Ports: { '22222/tcp': [{ HostPort: '22222' }] } },
				})
				.onSecondCall()
				.resolves({
					State: { Status: 'running' },
					Created: '2024-01-01T00:00:00.000Z',
					Config: { Env: [] },
					NetworkSettings: { Ports: {} },
				});

			const result = await listContainers(mockDockerClient as never);

			// Should only include balenaos-vm container
			expect(result).to.have.length(1);
			expect(result[0].name).to.equal('balenaos-vm-1-12345');
		});

		it('should extract SSH port from port bindings', async function () {
			mockListContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'] },
			]);

			mockInspect.resolves({
				State: { Status: 'running' },
				Created: '2024-01-01T00:00:00.000Z',
				Config: { Env: [] },
				NetworkSettings: {
					Ports: { '22222/tcp': [{ HostPort: '22223' }] },
				},
			});

			const result = await listContainers(mockDockerClient as never);

			expect(result[0].sshPort).to.equal(22223);
		});

		it('should return 0 for SSH port when not mapped', async function () {
			mockListContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'] },
			]);

			mockInspect.resolves({
				State: { Status: 'running' },
				Created: '2024-01-01T00:00:00.000Z',
				Config: { Env: [] },
				NetworkSettings: { Ports: {} },
			});

			const result = await listContainers(mockDockerClient as never);

			expect(result[0].sshPort).to.equal(0);
		});

		it('should map container status correctly', async function () {
			mockListContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'] },
			]);

			mockInspect.resolves({
				State: { Status: 'exited' },
				Created: '2024-01-01T00:00:00.000Z',
				Config: { Env: [] },
				NetworkSettings: { Ports: {} },
			});

			const result = await listContainers(mockDockerClient as never);

			expect(result[0].status).to.equal('exited');
		});

		it('should sort containers by name', async function () {
			mockListContainers.resolves([
				{ Id: 'def456', Names: ['/balenaos-vm-2-12345'] },
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'] },
			]);

			mockInspect.resolves({
				State: { Status: 'running' },
				Created: '2024-01-01T00:00:00.000Z',
				Config: { Env: [] },
				NetworkSettings: { Ports: {} },
			});

			const result = await listContainers(mockDockerClient as never);

			expect(result).to.have.length(2);
			expect(result[0].name).to.equal('balenaos-vm-1-12345');
			expect(result[1].name).to.equal('balenaos-vm-2-12345');
		});
	});

	describe('stopContainer()', function () {
		let stopContainer: typeof import('../../../build/utils/virtual-device/docker.js').stopContainer;
		let mockDockerClient: {
			getContainer: sinon.SinonStub;
		};

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			stopContainer = dockerModule.stopContainer;
		});

		it('should stop a running container', async function () {
			const mockStop = sandbox.stub().resolves();
			const mockInspect = sandbox.stub().resolves({
				State: { Running: true },
			});

			mockDockerClient = {
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
					stop: mockStop,
				}),
			};

			await stopContainer('test-container', mockDockerClient as never);

			expect(mockStop.calledOnce).to.be.true;
		});

		it('should not call stop on already stopped container', async function () {
			const mockStop = sandbox.stub().resolves();
			const mockInspect = sandbox.stub().resolves({
				State: { Running: false },
			});

			mockDockerClient = {
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
					stop: mockStop,
				}),
			};

			await stopContainer('test-container', mockDockerClient as never);

			expect(mockStop.called).to.be.false;
		});

		it('should ignore "no such container" errors', async function () {
			const mockInspect = sandbox
				.stub()
				.rejects(new Error('no such container'));

			mockDockerClient = {
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
				}),
			};

			// Should not throw
			await stopContainer('nonexistent', mockDockerClient as never);
		});
	});

	describe('startContainer()', function () {
		let startContainer: typeof import('../../../build/utils/virtual-device/docker.js').startContainer;
		let mockDockerClient: {
			getContainer: sinon.SinonStub;
		};

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			startContainer = dockerModule.startContainer;
		});

		it('should start a stopped container and return VirtInstance', async function () {
			const mockStart = sandbox.stub().resolves();
			const mockInspect = sandbox
				.stub()
				.onFirstCall()
				.resolves({
					State: { Running: false },
				})
				.onSecondCall()
				.resolves({
					Id: 'abc123',
					Name: '/balenaos-vm-1-12345',
					Created: '2024-01-01T00:00:00.000Z',
					State: { Status: 'running', Running: true },
					Config: {
						Env: [],
					},
					NetworkSettings: {
						Ports: { '22222/tcp': [{ HostPort: '22222' }] },
					},
				});

			mockDockerClient = {
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
					start: mockStart,
				}),
			};

			const result = await startContainer(
				'test-container',
				mockDockerClient as never,
			);

			expect(mockStart.calledOnce).to.be.true;
			expect(result.name).to.equal('balenaos-vm-1-12345');
			expect(result.status).to.equal('running');
			expect(result.sshPort).to.equal(22222);
		});

		it('should throw error if container is already running', async function () {
			const mockInspect = sandbox.stub().resolves({
				State: { Running: true },
			});

			mockDockerClient = {
				getContainer: sandbox.stub().returns({
					inspect: mockInspect,
				}),
			};

			await expect(
				startContainer('running-container', mockDockerClient as never),
			).to.be.rejectedWith('already running');
		});
	});
});
