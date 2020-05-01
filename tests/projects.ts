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

import * as fs from 'fs';
import * as path from 'path';
import { Headers } from 'tar-stream';
import { promisify } from 'util';

const statAsync = promisify(fs.stat);

export interface ExpectedTarStreamFile {
	contents?: string;
	fileSize: number;
	testStream?: (
		header: Headers,
		stream: import('stream').Readable,
		expected?: ExpectedTarStreamFile,
	) => Promise<void>;
	type: Headers['type'];
}

export interface ExpectedTarStreamFiles {
	[filePath: string]: ExpectedTarStreamFile;
}

export interface ExpectedTarStreamFilesByService {
	[service: string]: ExpectedTarStreamFiles;
}

export const repoPath = path.normalize(path.join(__dirname, '..'));
export const projectsPath = path.join(
	repoPath,
	'tests',
	'test-data',
	'projects',
);

export async function setupDockerignoreTestData({ cleanup = false } = {}) {
	const { copy, remove } = await import('fs-extra');
	const dockerignoreProjDir = path.join(
		__dirname,
		'test-data',
		'projects',
		'no-docker-compose',
		'dockerignore1',
	);
	const subdirs = ['', 'vendor'];
	for (const subdir of subdirs) {
		// A git repo cannot store a '.git' subfolder, even under tests/test-data/,
		// so we store a 'dot.git' folder instead, and copy it as '.git' before
		// running the tests. (Interestingly, 'git status' also ignores the '.git'
		// folder, and shows a "clean repo" even after this copy is executed.)
		const aliasDir = path.join(dockerignoreProjDir, subdir, 'dot.git');
		const gitDir = path.join(dockerignoreProjDir, subdir, '.git');
		await remove(gitDir);
		if (!cleanup) {
			await copy(aliasDir, gitDir);
		}
	}
}

export async function addRegSecretsEntries(
	expectedFiles: ExpectedTarStreamFiles,
): Promise<string> {
	const regSecretsPath = path.join(projectsPath, 'registry-secrets.json');
	expectedFiles['.balena/registry-secrets.json'] = {
		fileSize: (await statAsync(regSecretsPath)).size,
		type: 'file',
	};
	return regSecretsPath;
}
