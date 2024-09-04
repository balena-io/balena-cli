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

import { promises as fs } from 'fs';
import * as path from 'path';
import type { Headers } from 'tar-stream';

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

export const repoPath = path.normalize(path.join(import.meta.dirname, '..'));
export const projectsPath = path.join(
	repoPath,
	'tests',
	'test-data',
	'projects',
);

export async function exists(fPath: string) {
	try {
		await fs.stat(fPath);
		return true;
	} catch (e) {
		return false;
	}
}

export async function setupDockerignoreTestData({ cleanup = false } = {}) {
	const { copy, remove } = await import('fs-extra');
	const dockerignoreProjDir = path.join(
		import.meta.dirname,
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
		fileSize: (await fs.stat(regSecretsPath)).size,
		type: 'file',
	};
	return regSecretsPath;
}

export function getDockerignoreWarn1(paths: string[], cmd: string) {
	const lines = [
		'[Warn] The following .dockerignore file(s) will not be used:',
	];
	lines.push(...paths.map((p) => `[Warn] * ${p}`));
	lines.push(
		...[
			'[Warn] By default, only one .dockerignore file at the source folder (project',
			'[Warn] root) is used. Microservices (multicontainer) fleets may use a separate',
			'[Warn] .dockerignore file for each service with the --multi-dockerignore (-m)',
			`[Warn] option. See "balena help ${cmd}" for more details.`,
		],
	);
	return lines;
}

export function getDockerignoreWarn2(paths: string[], cmd: string) {
	const lines = [
		'[Warn] The following .dockerignore file(s) will not be used:',
	];
	lines.push(...paths.map((p) => `[Warn] * ${p}`));
	lines.push(
		...[
			'[Warn] When --multi-dockerignore (-m) is used, only .dockerignore files at the',
			"[Warn] root of each service's build context (in a microservices/multicontainer",
			'[Warn] fleet), plus a .dockerignore file at the overall project root, are used.',
			`[Warn] See "balena help ${cmd}" for more details.`,
		],
	);
	return lines;
}

export function getDockerignoreWarn3(cmd: string) {
	return [
		`[Info] ---------------------------------------------------------------------------`,
		'[Info] The --multi-dockerignore option is being used, and a .dockerignore file was',
		'[Info] found at the project source (root) directory. Note that this file will not',
		`[Info] be used to filter service subdirectories. See "balena help ${cmd}".`,
		`[Info] ---------------------------------------------------------------------------`,
	];
}
