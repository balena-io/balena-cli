/**
 * @license
 * Copyright 2019 Balena Ltd.
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
import _ from 'lodash';
import type { Stats } from 'fs';
import { promises as fs } from 'fs';
import * as path from 'path';

import type { Ignore } from '@balena/dockerignore';

import { ExpectedError } from '../errors.js';

export interface FileStats {
	filePath: string;
	relPath: string;
	stats: Stats;
}

/**
 * Create a list of files for the filesystem subtree rooted at
 * projectDir, excluding entries for directories themselves.
 * @param projectDir Source directory (root of subtree to be listed)
 */
async function listFiles(projectDir: string): Promise<string[]> {
	const files: string[] = [];
	async function walk(currentDirs: string[]): Promise<string[]> {
		if (!currentDirs.length) {
			return files;
		}

		const foundDirs: string[] = [];

		// Because `currentDirs` can be of arbitrary length, process them in smaller batches
		// to avoid out of memory errors.
		// This approach is significantly faster than using Bluebird.map with a
		// concurrency setting
		const chunks = _.chunk(currentDirs, 100);
		for (const chunk of chunks) {
			await Promise.all(
				chunk.map(async (dir) => {
					const _files = await fs.readdir(dir, { withFileTypes: true });
					for (const entry of _files) {
						const fpath = path.join(dir, entry.name);
						const isDirectory =
							entry.isDirectory() ||
							(entry.isSymbolicLink() && (await fs.stat(fpath)).isDirectory());

						if (isDirectory) {
							foundDirs.push(fpath);
						} else {
							files.push(fpath);
						}
					}
				}),
			);
		}
		return walk(foundDirs);
	}
	return walk([projectDir]);
}

/**
 * Return the contents of a .dockerignore file at projectDir, as a string.
 * Return an empty string if a .dockerignore file does not exist.
 * @param projectDir Source directory
 * @returns Contents of the .dockerignore file, as a UTF-8 string
 */
async function readDockerIgnoreFile(projectDir: string): Promise<string> {
	const dockerIgnorePath = path.join(projectDir, '.dockerignore');
	let dockerIgnoreStr = '';
	try {
		dockerIgnoreStr = await fs.readFile(dockerIgnorePath, 'utf8');
	} catch (err: any) {
		if (err.code !== 'ENOENT') {
			throw new ExpectedError(
				`Error reading file "${dockerIgnorePath}": ${err.message}`,
			);
		}
	}
	return dockerIgnoreStr;
}

/**
 * Create an instance of '@balena/dockerignore', initialized with the contents
 * of a .dockerignore file (if any) found at the given directory argument, plus
 * a set of default/hardcoded patterns.
 * @param directory Directory where to look for a .dockerignore file
 */
export async function getDockerIgnoreInstance(
	directory: string,
): Promise<Ignore> {
	const dockerIgnoreStr = await readDockerIgnoreFile(directory);
	const $dockerIgnore = (await import('@balena/dockerignore')).default;
	const ig = $dockerIgnore.default({ ignorecase: false });

	ig.add(['**/.git']);
	if (dockerIgnoreStr) {
		ig.add(dockerIgnoreStr);
	}
	ig.add([
		'!**/.balena',
		'!**/.resin',
		'!**/Dockerfile',
		'!**/Dockerfile.*',
		'!**/docker-compose.yml',
	]);
	return ig;
}

export interface ServiceDirs {
	[service: string]: string;
}

/**
 * Create a list of files (FileStats[]) for the filesystem subtree rooted at
 * projectDir, filtered against the applicable .dockerignore files, including
 * a few default/hardcoded dockerignore patterns.
 * @param projectDir Source directory
 * @param multiDockerignore The --multi-dockerignore (-m) option
 * @param serviceDirsByService Map of service names to their subdirectories.
 * The service directory names/paths must be relative to the project root dir
 * and be "normalized" (path.normalize()) before the call to this function:
 * they should use backslashes on Windows, not contain '.' or '..' segments and
 * not contain multiple consecutive path separators like '//'. Also, relative
 * paths must not start with './' (e.g. 'a/b' instead of './a/b').
 */
export async function filterFilesWithDockerignore(
	projectDir: string,
	multiDockerignore: boolean,
	serviceDirsByService: ServiceDirs,
): Promise<{
	filteredFileList: FileStats[];
	dockerignoreFiles: FileStats[];
}> {
	// path.resolve() also converts forward slashes to backslashes on Windows
	projectDir = path.resolve(projectDir);
	const root = '.' + path.sep;
	const ignoreByService = await getDockerignoreByService(
		projectDir,
		multiDockerignore,
		serviceDirsByService,
	);
	// Sample contents of ignoreByDir:
	// { './': (dockerignore instance), 'foo/': (dockerignore instance) }
	const ignoreByDir: { [serviceDir: string]: Ignore } = {};
	for (let [serviceName, dir] of Object.entries(serviceDirsByService)) {
		// convert slashes to backslashes on Windows, resolve '..' segments
		dir = path.normalize(dir);
		// add a trailing '/' (or '\' on Windows) to the path
		dir = dir.endsWith(path.sep) ? dir : dir + path.sep;
		ignoreByDir[dir] = ignoreByService[serviceName];
	}
	if (!ignoreByDir[root]) {
		ignoreByDir[root] = await getDockerIgnoreInstance(projectDir);
	}
	const dockerignoreServiceDirs: string[] = multiDockerignore
		? Object.keys(ignoreByDir).filter((dir) => dir && dir !== root)
		: [];
	const files = await listFiles(projectDir);

	const dockerignoreFiles: FileStats[] = [];
	const filteredFileList: FileStats[] = [];

	// Because `files` can be of arbitrary length, process them in smaller batches
	// to avoid out of memory errors.
	// This approach is significantly faster than using Bluebird.map with a
	// concurrency setting
	const chunks = _.chunk(files, 750);
	for (const chunk of chunks) {
		await Promise.all(
			chunk.map(async (filePath) => {
				const relPath = path.relative(projectDir, filePath);

				// .dockerignore files are always added to a list of known dockerignore files
				if (path.basename(relPath) === '.dockerignore') {
					const diStats = await fs.stat(filePath);
					dockerignoreFiles.push({
						filePath,
						relPath,
						stats: diStats,
					});
				}

				// First check if the file is ignored by a .dockerignore file in a service directory
				const matchingDir = dockerignoreServiceDirs.find((dir) => {
					return relPath.startsWith(dir);
				});

				// If the file is ignore in a service directory, exit early, otherwise check if it is ignored by the root .dockerignore file.
				// Crucially, if the file is in a known service directory, and isn't ignored, the root .dockerignore file should not be checked.
				if (matchingDir) {
					if (
						ignoreByDir[matchingDir].ignores(
							relPath.substring(matchingDir.length),
						)
					) {
						return;
					}
				} else if (ignoreByDir[root].ignores(relPath)) {
					return;
				}

				// At this point we can do a final stat of the file, and check if it should be included
				const stats = await fs.stat(filePath);

				// filePath may be a special file that we should ignore, such as a socket
				if (stats.isFile()) {
					filteredFileList.push({
						filePath,
						relPath,
						stats,
					});
				}
			}),
		);
	}

	return { filteredFileList, dockerignoreFiles };
}

let dockerignoreByService: { [serviceName: string]: Ignore } | null = null;

/**
 * Get dockerignore instances for each service in serviceDirsByService.
 * Dockerignore instances are cached and may be shared between services.
 * @param projectDir Source directory
 * @param multiDockerignore The --multi-dockerignore (-m) option
 * @param serviceDirsByService Map of service names to their subdirectories
 */
export async function getDockerignoreByService(
	projectDir: string,
	multiDockerignore: boolean,
	serviceDirsByService: ServiceDirs,
): Promise<{ [serviceName: string]: Ignore }> {
	if (dockerignoreByService) {
		return dockerignoreByService;
	}
	const cachedDirs: { [dir: string]: Ignore } = {};
	// path.resolve() converts to an absolute path, removes trailing slashes,
	// and also converts forward slashes to backslashes on Windows.
	projectDir = path.resolve(projectDir);
	dockerignoreByService = {};

	for (let [serviceName, dir] of Object.entries(serviceDirsByService)) {
		dir = multiDockerignore ? dir : '.';
		const absDir = path.resolve(projectDir, dir);
		if (!cachedDirs[absDir]) {
			cachedDirs[absDir] = await getDockerIgnoreInstance(absDir);
		}
		dockerignoreByService[serviceName] = cachedDirs[absDir];
	}

	return dockerignoreByService;
}
