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

// tslint:disable-next-line:no-var-requires
require('./../config-tests'); // required for side effects

import { expect } from 'chai';
import * as _ from 'lodash';
import * as path from 'path';
import * as tar from 'tar-stream';

import { tarDirectory } from '../../build/utils/compose';
import { setupDockerignoreTestData } from '../projects';

const repoPath = path.normalize(path.join(__dirname, '..', '..'));
const projectsPath = path.join(repoPath, 'tests', 'test-data', 'projects');

interface TarFiles {
	[name: string]: {
		fileSize?: number;
		type?: string | null;
	};
}

const itSkipWindows = process.platform === 'win32' ? it.skip : it;

describe('compare new and old tarDirectory implementations', function () {
	const extraContent = 'extra';
	const extraEntry: tar.Headers = {
		name: 'extra.txt',
		size: extraContent.length,
		type: 'file',
	};
	const preFinalizeCallback = (pack: tar.Pack) => {
		pack.entry(extraEntry, extraContent);
	};

	this.beforeAll(async () => {
		await setupDockerignoreTestData();
	});

	this.afterAll(async () => {
		await setupDockerignoreTestData({ cleanup: true });
	});

	// NOTE: if this test or other tests involving symbolic links fail on Windows
	// (with a mismatched fileSize 13 vs 5 for 'symlink-a.txt'), ensure that the
	// `core.symlinks` property is set to `true` in the `.git/config` file. Ref:
	// https://git-scm.com/docs/git-config#Documentation/git-config.txt-coresymlinks
	it('should produce the expected file list', async function () {
		const dockerignoreProjDir = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore1',
		);
		const expectedFiles = {
			'.balena/balena.yml': { fileSize: 12, type: 'file' },
			'.dockerignore': { fileSize: 438, type: 'file' },
			'.gitignore': { fileSize: 20, type: 'file' },
			'.git/foo.txt': { fileSize: 4, type: 'file' },
			'a.txt': { fileSize: 1, type: 'file' },
			'c.txt': { fileSize: 1, type: 'file' },
			Dockerfile: { fileSize: 13, type: 'file' },
			'extra.txt': { fileSize: 5, type: 'file' },
			'src/.balena/balena.yml': { fileSize: 16, type: 'file' },
			'src/.gitignore': { fileSize: 10, type: 'file' },
			'src/src-a.txt': { fileSize: 5, type: 'file' },
			'src/src-c.txt': { fileSize: 5, type: 'file' },
			'vendor/.git/vendor-git-contents': { fileSize: 20, type: 'file' },
		};

		const tarPack = await tarDirectory(dockerignoreProjDir, {
			preFinalizeCallback,
			nogitignore: true,
		});
		const fileList = await getTarPackFiles(tarPack);

		expect(fileList).to.deep.equal(expectedFiles);
	});

	it('should produce the expected file list (symbolic links)', async function () {
		const projectPath = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore2',
		);
		const expectedFiles = {
			'.dockerignore': { fileSize: 33, type: 'file' },
			'b.txt': { fileSize: 1, type: 'file' },
			Dockerfile: { fileSize: 13, type: 'file' },
			'lib/.dockerignore': { fileSize: 10, type: 'file' },
			'lib/src-b.txt': { fileSize: 5, type: 'file' },
			'src/src-b.txt': { fileSize: 5, type: 'file' },
			'symlink-a.txt': { fileSize: 5, type: 'file' },
		};

		const tarPack = await tarDirectory(projectPath, { nogitignore: true });
		const fileList = await getTarPackFiles(tarPack);

		expect(fileList).to.deep.equal(expectedFiles);
	});

	// Skip Windows because the old tarDirectory() implementation (still used when
	// '--gitignore' is provided) uses the old `zeit/dockerignore` npm package
	// that is broken on Windows (reason why we created `@balena/dockerignore`).
	itSkipWindows('should produce a compatible tar stream', async function () {
		const dockerignoreProjDir = path.join(
			projectsPath,
			'no-docker-compose',
			'dockerignore1',
		);
		const oldTarPack = await tarDirectory(dockerignoreProjDir, {
			preFinalizeCallback,
			nogitignore: false,
		});
		const oldFileList = await getTarPackFiles(oldTarPack);

		const newTarPack = await tarDirectory(dockerignoreProjDir, {
			preFinalizeCallback,
			nogitignore: true,
		});
		const newFileList = await getTarPackFiles(newTarPack);

		const gitIgnored = ['a.txt', 'src/src-a.txt', 'src/src-c.txt'];

		expect({
			...newFileList,
			..._.pick(oldFileList, ['.git/bar.txt']),
		}).to.deep.equal({
			...oldFileList,
			..._.pick(newFileList, gitIgnored),
		});
	});

	itSkipWindows(
		'should produce a compatible tar stream (symbolic links)',
		async function () {
			const dockerignoreProjDir = path.join(
				projectsPath,
				'no-docker-compose',
				'dockerignore2',
			);
			const oldTarPack = await tarDirectory(dockerignoreProjDir, {
				preFinalizeCallback,
				nogitignore: false,
			});
			const oldFileList = await getTarPackFiles(oldTarPack);

			const newTarPack = await tarDirectory(dockerignoreProjDir, {
				preFinalizeCallback,
				nogitignore: true,
			});
			const newFileList = await getTarPackFiles(newTarPack);

			expect(newFileList).to.deep.equal(oldFileList);
		},
	);
});

async function getTarPackFiles(
	pack: import('stream').Readable,
): Promise<TarFiles> {
	const { drainStream } = await import('tar-utils');
	const fileList: TarFiles = {};
	const extract = tar.extract();

	return await new Promise((resolve, reject) => {
		extract
			.on('error', reject)
			.on('entry', async function (header, stream, next) {
				expect(fileList).to.not.have.property(header.name);
				fileList[header.name] = {
					fileSize: header.size,
					type: header.type,
				};
				await drainStream(stream);
				next();
			})
			.on('finish', function () {
				resolve(fileList);
			});
		pack.pipe(extract);
	});
}
