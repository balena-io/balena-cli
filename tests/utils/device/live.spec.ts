/**
 * @license
 * Copyright 2020 Balena Ltd.
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
import type * as chokidar from 'chokidar';
import { promises as fs } from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { LivepushManager } from '../../../lib/utils/device/live';
import { resetDockerignoreCache } from '../../docker-build';
import { setupDockerignoreTestData } from '../../projects';

const delay = promisify(setTimeout);
const FS_WATCH_DURATION_MS = 500;

const repoPath = path.normalize(
	path.join(import.meta.dirname, '..', '..', '..'),
);
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

interface ByService<T> {
	[serviceName: string]: T;
}

class MockLivepushManager extends LivepushManager {
	public constructor() {
		super({
			buildContext: '',
			composition: { version: '2.1', services: {} },
			buildTasks: [],
			docker: {} as import('dockerode'),
			api: {} as import('../../../lib/utils/device/api').DeviceAPI,
			logger: {} as import('../../../lib/utils/logger'),
			imageIds: {},
			deployOpts:
				{} as import('../../../lib/utils/device/deploy').DeviceDeployOptions,
		});
	}

	public testSetupFilesystemWatcher(
		serviceName: string,
		rootContext: string,
		serviceContext: string,
		changedPathHandler: (serviceName: string, changedPath: string) => void,
		dockerignoreByService: ByService<import('@balena/dockerignore').Ignore>,
		multiDockerignore: boolean,
	): import('chokidar').FSWatcher {
		return super.setupFilesystemWatcher(
			serviceName,
			rootContext,
			serviceContext,
			changedPathHandler,
			dockerignoreByService,
			multiDockerignore,
		);
	}
}

// "describeSS" stands for "describe Skip Standalone"
const describeSS =
	process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? describe.skip : describe;

describeSS('LivepushManager::setupFilesystemWatcher', function () {
	const manager = new MockLivepushManager();

	async function createMonitors(
		projectPath: string,
		composition: import('@balena/compose/dist/parse').Composition,
		multiDockerignore: boolean,
		changedPathHandler: (serviceName: string, changedPath: string) => void,
	): Promise<ByService<chokidar.FSWatcher>> {
		const { getServiceDirsFromComposition } = await import(
			'../../../build/utils/compose_ts.js'
		);
		const { getDockerignoreByService } = await import(
			'../../../build/utils/ignore.js'
		);
		const rootContext = path.resolve(projectPath);

		const monitors: ByService<chokidar.FSWatcher> = {};

		const serviceDirsByService = await getServiceDirsFromComposition(
			projectPath,
			composition,
		);
		const dockerignoreByService = await getDockerignoreByService(
			projectPath,
			multiDockerignore,
			serviceDirsByService,
		);

		for (const serviceName of Object.keys(composition.services)) {
			const service = composition.services[serviceName];
			const serviceContext = path.resolve(rootContext, service.build!.context);

			const monitor = manager.testSetupFilesystemWatcher(
				serviceName,
				rootContext,
				serviceContext,
				changedPathHandler,
				dockerignoreByService,
				multiDockerignore,
			);
			monitors[serviceName] = monitor;

			await new Promise((resolve, reject) => {
				monitor.on('error', reject);
				monitor.on('ready', resolve);
			});
		}
		return monitors;
	}

	this.beforeAll(async () => {
		await setupDockerignoreTestData();
	});

	this.afterAll(async () => {
		await setupDockerignoreTestData({ cleanup: true });
	});

	this.beforeEach(() => {
		resetDockerignoreCache();
	});

	describe('for project no-docker-compose/basic', function () {
		const projectPath = path.join(projectsPath, 'no-docker-compose', 'basic');
		const composition = {
			version: '2.1',
			services: {
				main: { build: { context: '.' } },
			},
		};

		it('should trigger change events for paths that are not ignored', async () => {
			const changedPaths: ByService<string[]> = { main: [] };
			const multiDockerignore = true;
			const monitors = await createMonitors(
				projectPath,
				composition,
				multiDockerignore,
				(serviceName: string, changedPath: string) => {
					changedPaths[serviceName].push(changedPath);
				},
			);

			await Promise.all([
				touch(path.join(projectPath, 'Dockerfile')),
				touch(path.join(projectPath, 'src', 'start.sh')),
				touch(path.join(projectPath, 'src', 'windows-crlf.sh')),
			]);

			// wait a bit so that filesystem modifications are notified
			await delay(FS_WATCH_DURATION_MS);

			await Promise.all(
				Object.values(monitors).map((monitor) => monitor.close()),
			);

			expect(changedPaths['main']).to.have.members([
				'Dockerfile',
				path.join('src', 'start.sh'),
				path.join('src', 'windows-crlf.sh'),
			]);
		});
	});

	describe('for project no-docker-compose/dockerignore1', function () {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore1',
		);
		const composition = {
			version: '2.1',
			services: {
				main: { build: { context: '.' } },
			},
		};

		it('should trigger change events for paths that are not ignored', async () => {
			const changedPaths: ByService<string[]> = { main: [] };
			const multiDockerignore = true;
			const monitors = await createMonitors(
				projectPath,
				composition,
				multiDockerignore,
				(serviceName: string, changedPath: string) => {
					changedPaths[serviceName].push(changedPath);
				},
			);

			await Promise.all([
				touch(path.join(projectPath, 'a.txt')),
				touch(path.join(projectPath, 'b.txt')),
				touch(path.join(projectPath, 'vendor', '.git', 'vendor-git-contents')),
				touch(path.join(projectPath, 'src', 'src-a.txt')),
				touch(path.join(projectPath, 'src', 'src-b.txt')),
			]);

			// wait a bit so that filesystem modifications are notified
			await delay(FS_WATCH_DURATION_MS);

			await Promise.all(
				Object.values(monitors).map((monitor) => monitor.close()),
			);

			expect(changedPaths['main']).to.have.members([
				'a.txt',
				path.join('src', 'src-a.txt'),
				path.join('vendor', '.git', 'vendor-git-contents'),
			]);
		});
	});

	describe('for project no-docker-compose/dockerignore2', function () {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore2',
		);
		const composition = {
			version: '2.1',
			services: {
				main: { build: { context: '.' } },
			},
		};

		it('should trigger change events for paths that are not ignored', async () => {
			const changedPaths: ByService<string[]> = { main: [] };
			const multiDockerignore = true;
			const monitors = await createMonitors(
				projectPath,
				composition,
				multiDockerignore,
				(serviceName: string, changedPath: string) => {
					changedPaths[serviceName].push(changedPath);
				},
			);

			await Promise.all([
				touch(path.join(projectPath, 'a.txt')),
				touch(path.join(projectPath, 'b.txt')),
				touch(path.join(projectPath, 'lib', 'src-a.txt')),
				touch(path.join(projectPath, 'lib', 'src-b.txt')),
				touch(path.join(projectPath, 'src', 'src-a.txt')),
				touch(path.join(projectPath, 'src', 'src-b.txt')),
				touch(path.join(projectPath, 'symlink-a.txt')),
				touch(path.join(projectPath, 'symlink-b.txt')),
			]);

			// wait a bit so that filesystem modifications are notified
			await delay(FS_WATCH_DURATION_MS);

			await Promise.all(
				Object.values(monitors).map((monitor) => monitor.close()),
			);

			// chokidar appears to treat symbolic links differently on different
			// platforms like Linux and macOS. On Linux only, change events are
			// reported for symlinks when the target file they point to is changed.
			// We tolerate this difference in this test case.
			const expectedNoSymlink = [
				'b.txt',
				path.join('lib', 'src-b.txt'),
				path.join('src', 'src-b.txt'),
			];
			const expectedWithSymlink = [...expectedNoSymlink, 'symlink-a.txt'];
			expect(changedPaths['main']).to.include.members(expectedNoSymlink);
			expect(expectedWithSymlink).to.include.members(changedPaths['main']);
		});
	});

	describe('for project docker-compose/basic', function () {
		const projectPath = path.join(projectsPath, 'docker-compose', 'basic');
		const composition = {
			version: '2.1',
			services: {
				service1: { build: { context: 'service1' } },
				service2: { build: { context: 'service2' } },
			},
		};

		it('should trigger change events for paths that are not ignored (docker-compose)', async () => {
			const changedPaths: ByService<string[]> = {
				service1: [],
				service2: [],
			};
			const multiDockerignore = false;
			const monitors = await createMonitors(
				projectPath,
				composition,
				multiDockerignore,
				(serviceName: string, changedPath: string) => {
					changedPaths[serviceName].push(changedPath);
				},
			);

			await Promise.all([
				touch(path.join(projectPath, 'service1', 'test-ignore.txt')),
				touch(path.join(projectPath, 'service1', 'file1.sh')),
				touch(path.join(projectPath, 'service2', 'src', 'file1.sh')),
				touch(path.join(projectPath, 'service2', 'file2-crlf.sh')),
			]);

			// wait a bit so that filesystem modifications are notified
			await delay(FS_WATCH_DURATION_MS);

			await Promise.all(
				Object.values(monitors).map((monitor) => monitor.close()),
			);

			expect(changedPaths['service1']).to.have.members(['file1.sh']);
			expect(changedPaths['service2']).to.have.members([
				path.join('src', 'file1.sh'),
				'file2-crlf.sh',
			]);
		});

		it('should trigger change events for paths that are not ignored (docker-compose, multi-dockerignore)', async () => {
			const changedPaths: ByService<string[]> = {
				service1: [],
				service2: [],
			};
			const multiDockerignore = true;
			const monitors = await createMonitors(
				projectPath,
				composition,
				multiDockerignore,
				(serviceName: string, changedPath: string) => {
					changedPaths[serviceName].push(changedPath);
				},
			);

			await Promise.all([
				touch(path.join(projectPath, 'service1', 'test-ignore.txt')),
				touch(path.join(projectPath, 'service1', 'file1.sh')),
				touch(path.join(projectPath, 'service2', 'src', 'file1.sh')),
				touch(path.join(projectPath, 'service2', 'file2-crlf.sh')),
			]);

			// wait a bit so that filesystem modifications are notified
			await delay(FS_WATCH_DURATION_MS);

			await Promise.all(
				Object.values(monitors).map((monitor) => monitor.close()),
			);

			expect(changedPaths['service1']).to.have.members([
				'file1.sh',
				'test-ignore.txt',
			]);
			expect(changedPaths['service2']).to.have.members(['file2-crlf.sh']);
		});
	});
});

async function touch(filePath: string) {
	const time = new Date();
	return fs.utimes(filePath, time, time);
}
