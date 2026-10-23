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
			mockImageInspect.rejects(Object.assign(new Error('No such image'), { statusCode: 404 }));

			const result = await imageExists(mockDockerClient as never);
			expect(result).to.be.false;
		});

		it('should throw on non-404 Docker errors', async function () {
			mockImageInspect.rejects(Object.assign(new Error('connection refused'), { statusCode: 500 }));

			await expect(imageExists(mockDockerClient as never)).to.be.rejectedWith('connection refused');
		});
	});

	describe('listContainers()', function () {
		let listContainers: typeof import('../../../build/utils/virtual-device/docker.js').listContainers;
		let mockDockerClient: { listContainers: sinon.SinonStub };

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			listContainers = dockerModule.listContainers;
			mockDockerClient = { listContainers: sandbox.stub() };
		});

		it('should return empty array when no containers exist', async function () {
			mockDockerClient.listContainers.resolves([]);
			const result = await listContainers(mockDockerClient as never);
			expect(result).to.be.an('array').with.length(0);
		});

		it('should filter containers by balenaos-vm prefix', async function () {
			mockDockerClient.listContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'], State: 'running', Ports: [{ PrivatePort: 22222, PublicPort: 22222, Type: 'tcp' }], Created: 1704067200 },
				{ Id: 'def456', Names: ['/other-container'], State: 'running', Ports: [], Created: 1704067200 },
			]);
			const result = await listContainers(mockDockerClient as never);
			expect(result).to.have.length(1);
			expect(result[0].name).to.equal('balenaos-vm-1-12345');
		});

		it('should extract SSH port from port bindings', async function () {
			mockDockerClient.listContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'], State: 'running', Ports: [{ PrivatePort: 22222, PublicPort: 22223, Type: 'tcp' }], Created: 1704067200 },
			]);
			const result = await listContainers(mockDockerClient as never);
			expect(result[0].sshPort).to.equal(22223);
		});

		it('should return 0 for SSH port when not mapped', async function () {
			mockDockerClient.listContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'], State: 'running', Ports: [], Created: 1704067200 },
			]);
			const result = await listContainers(mockDockerClient as never);
			expect(result[0].sshPort).to.equal(0);
		});

		it('should map container status correctly', async function () {
			mockDockerClient.listContainers.resolves([
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'], State: 'exited', Ports: [], Created: 1704067200 },
			]);
			const result = await listContainers(mockDockerClient as never);
			expect(result[0].status).to.equal('exited');
		});

		it('should sort containers by name', async function () {
			mockDockerClient.listContainers.resolves([
				{ Id: 'def456', Names: ['/balenaos-vm-2-12345'], State: 'running', Ports: [], Created: 1704067200 },
				{ Id: 'abc123', Names: ['/balenaos-vm-1-12345'], State: 'running', Ports: [], Created: 1704067200 },
			]);
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

		it('should ignore 404 (container not found) errors', async function () {
			const mockInspect = sandbox
				.stub()
				.rejects(Object.assign(new Error('no such container'), { statusCode: 404 }));

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

	describe('findContainer()', function () {
		let findContainer: typeof import('../../../build/utils/virtual-device/docker.js').findContainer;
		let mockDockerClient: any;
		const sandbox2 = sinon.createSandbox();

		function makeDockerMock(containers: Array<{ name: string; id: string; status: string; sshPort: number }>) {
			const listResult = containers.map((c) => ({
				Id: c.id,
				Names: [`/${c.name}`],
				State: c.status,
				Ports: c.sshPort > 0
					? [{ PrivatePort: 22222, PublicPort: c.sshPort, Type: 'tcp' }]
					: [],
				Created: 1700000000,
			}));

			return {
				listContainers: sandbox2.stub().resolves(listResult),
				getContainer: sandbox2.stub().callsFake(() => ({
					inspect: sandbox2.stub().resolves({
						HostConfig: { Binds: [] },
					}),
				})),
			};
		}

		const testContainers = [
			{ name: 'balenaos-vm-1-1700000000', id: 'abc123def456', status: 'running', sshPort: 22222 },
			{ name: 'balenaos-vm-3-1700000001', id: 'def789ghi012', status: 'exited', sshPort: 22223 },
		];

		beforeEach(async function () {
			const dockerModule = await import(
				'../../../build/utils/virtual-device/docker.js'
			);
			findContainer = dockerModule.findContainer;
			mockDockerClient = makeDockerMock(testContainers);
		});

		afterEach(function () {
			sandbox2.restore();
		});

		it('should find by exact name', async function () {
			const result = await findContainer(
				'balenaos-vm-1-1700000000',
				mockDockerClient as never,
			);
			expect(result.instance).to.not.be.null;
			expect(result.instance!.name).to.equal('balenaos-vm-1-1700000000');
		});

		it('should find by instance number', async function () {
			const result = await findContainer('3', mockDockerClient as never);
			expect(result.instance).to.not.be.null;
			expect(result.instance!.name).to.equal('balenaos-vm-3-1700000001');
		});

		it('should find by container ID prefix', async function () {
			const result = await findContainer('abc123', mockDockerClient as never);
			expect(result.instance).to.not.be.null;
			expect(result.instance!.containerId).to.equal('abc123def456');
		});

		it('should return null when no match', async function () {
			const result = await findContainer('nonexistent', mockDockerClient as never);
			expect(result.instance).to.be.null;
		});

		it('should not match instance number 1 against instance 10', async function () {
			mockDockerClient = makeDockerMock([
				{ name: 'balenaos-vm-10-1700000000', id: 'aaa111bbb222', status: 'running', sshPort: 22222 },
			]);

			const result = await findContainer('1', mockDockerClient as never);
			expect(result.instance).to.be.null;
		});
	});
});
