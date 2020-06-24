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
import * as _ from 'lodash';
import { promises as fs, Stats } from 'fs';
import * as path from 'path';
import * as MultiBuild from 'resin-multibuild';

import dockerIgnore = require('@zeit/dockerignore');
import ignore from 'ignore';

import { ExpectedError } from '../errors';

const { toPosixPath } = MultiBuild.PathUtils;

export enum IgnoreFileType {
	DockerIgnore,
	GitIgnore,
}

interface IgnoreEntry {
	pattern: string;
	// The relative file path from the base path of the build context
	filePath: string;
}

/**
 * This class is used by the CLI v10 / v11 "original" tarDirectory function
 * in `compose.js`. It is still around for the benefit of the `--gitignore`
 * option, but is expected to be deleted in CLI v13.
 */
export class FileIgnorer {
	private dockerIgnoreEntries: IgnoreEntry[];
	private gitIgnoreEntries: IgnoreEntry[];

	private static ignoreFiles: Array<{
		pattern: string;
		type: IgnoreFileType;
		allowSubdirs: boolean;
	}> = [
		{
			pattern: '.gitignore',
			type: IgnoreFileType.GitIgnore,
			allowSubdirs: true,
		},
		{
			pattern: '.dockerignore',
			type: IgnoreFileType.DockerIgnore,
			allowSubdirs: false,
		},
	];

	public constructor(public basePath: string) {
		this.dockerIgnoreEntries = [];
		this.gitIgnoreEntries = [];
	}
	/**
	 * @param  {string} relativePath
	 * 	The relative pathname from the build context, for example a root level .gitignore should be
	 * 		./.gitignore
	 * @returns IgnoreFileType
	 * 	The type of ignore file, or null
	 */
	public getIgnoreFileType(relativePath: string): IgnoreFileType | null {
		for (const { pattern, type, allowSubdirs } of FileIgnorer.ignoreFiles) {
			if (
				path.basename(relativePath) === pattern &&
				(allowSubdirs || path.dirname(relativePath) === '.')
			) {
				return type;
			}
		}

		return null;
	}
	/**
	 * @param  {string} fullPath
	 * 	The full path on disk of the ignore file
	 * @param  {IgnoreFileType} type
	 * @returns Promise
	 */
	public async addIgnoreFile(
		fullPath: string,
		type: IgnoreFileType,
	): Promise<void> {
		const contents = await fs.readFile(fullPath, 'utf8');

		contents.split('\n').forEach((line) => {
			// ignore empty lines and comments
			if (/\s*#/.test(line) || _.isEmpty(line)) {
				return;
			}

			this.addEntry(line, fullPath, type);
		});

		return;
	}

	// Pass this function as a predicate to a filter function, and it will filter
	// any ignored files
	public filter = (filename: string): boolean => {
		const relFile = path.relative(this.basePath, filename);

		// Don't ignore any metadata files
		// The regex below matches `.balena/qemu` and `myservice/.balena/qemu`
		// but not `some.dir.for.balena/qemu`.
		if (/(^|\/)\.(balena|resin)\//.test(toPosixPath(relFile))) {
			return true;
		}

		// Don't ignore Dockerfile (with or without extension) or docker-compose.yml
		if (
			/^Dockerfile$|^Dockerfile\.\S+/.test(path.basename(relFile)) ||
			path.basename(relFile) === 'docker-compose.yml'
		) {
			return true;
		}

		const dockerIgnoreHandle = dockerIgnore();
		const gitIgnoreHandle = ignore();

		interface IgnoreHandle {
			add: (pattern: string) => void;
			ignores: (file: string) => boolean;
		}

		const ignoreTypes: Array<{
			handle: IgnoreHandle;
			entries: IgnoreEntry[];
		}> = [
			{ handle: dockerIgnoreHandle, entries: this.dockerIgnoreEntries },
			{ handle: gitIgnoreHandle, entries: this.gitIgnoreEntries },
		];

		_.each(ignoreTypes, ({ handle, entries }) => {
			_.each(entries, ({ pattern, filePath }) => {
				if (FileIgnorer.contains(path.posix.dirname(filePath), filename)) {
					handle.add(pattern);
				}
			});
		});

		return !_.some(ignoreTypes, ({ handle }) => handle.ignores(relFile));
	}; // tslint:disable-line:semicolon

	private addEntry(
		pattern: string,
		filePath: string,
		type: IgnoreFileType,
	): void {
		const entry: IgnoreEntry = { pattern, filePath };
		switch (type) {
			case IgnoreFileType.DockerIgnore:
				this.dockerIgnoreEntries.push(entry);
				break;
			case IgnoreFileType.GitIgnore:
				this.gitIgnoreEntries.push(entry);
				break;
		}
	}

	/**
	 * Given two paths, check whether the first contains the second
	 * @param path1 The potentially containing path
	 * @param path2 The potentially contained path
	 * @return A boolean indicating whether `path1` contains `path2`
	 */
	private static contains(path1: string, path2: string): boolean {
		// First normalise the input, to remove any path weirdness
		path1 = path.posix.normalize(path1);
		path2 = path.posix.normalize(path2);

		// Now test if the start of the relative path contains ../ ,
		// which would tell us that path1 is not part of path2
		return !/^\.\.\//.test(path.posix.relative(path1, path2));
	}
}

export interface FileStats {
	filePath: string;
	relPath: string;
	stats: Stats;
}

/**
 * Create a list of files (FileStats[]) for the filesystem subtree rooted at
 * projectDir, listing each file with both a full path and a relative path,
 * but excluding entries for directories themselves.
 * @param projectDir Source directory (root of subtree to be listed)
 * @param dir Used for recursive calls only (omit on first function call)
 */
async function listFiles(
	projectDir: string,
	dir: string = projectDir,
): Promise<FileStats[]> {
	const files: FileStats[] = [];
	const dirEntries = await fs.readdir(dir);
	await Promise.all(
		dirEntries.map(async (entry) => {
			const filePath = path.join(dir, entry);
			const stats = await fs.stat(filePath);
			if (stats.isDirectory()) {
				files.push(...(await listFiles(projectDir, filePath)));
			} else if (stats.isFile()) {
				files.push({
					filePath,
					relPath: path.relative(projectDir, filePath),
					stats,
				});
			}
		}),
	);
	return files;
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
	} catch (err) {
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
async function getDockerIgnoreInstance(
	directory: string,
): Promise<import('@balena/dockerignore').Ignore> {
	const dockerIgnoreStr = await readDockerIgnoreFile(directory);
	const $dockerIgnore = (await import('@balena/dockerignore')).default;
	const ig = $dockerIgnore({ ignorecase: false });

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
 * @param projectDir Source directory to
 * @param serviceDirsByService Map of service names to their subdirectories.
 * The service directory names/paths must be relative to the project root dir
 * and be "normalized" (path.normalize()) before the call to this function:
 * they should use backslashes on Windows, not contain '.' or '..' segments and
 * not contain multiple consecutive path separators like '//'. Also, relative
 * paths must not start with './' (e.g. 'a/b' instead of './a/b').
 */
export async function filterFilesWithDockerignore(
	projectDir: string,
	serviceDirsByService?: ServiceDirs,
): Promise<{ filteredFileList: FileStats[]; dockerignoreFiles: FileStats[] }> {
	// path.resolve() also converts forward slashes to backslashes on Windows
	projectDir = path.resolve(projectDir);
	// ignoreByDir stores an instance of the dockerignore filter for each service dir
	const ignoreByDir: {
		[serviceDir: string]: import('@balena/dockerignore').Ignore;
	} = {
		'.': await getDockerIgnoreInstance(projectDir),
	};
	const serviceDirs: string[] = Object.values(serviceDirsByService || {})
		// filter out the project source/root dir
		.filter((dir) => dir && dir !== '.')
		// add a trailing '/' (or '\' on Windows) to the path
		.map((dir) => (dir.endsWith(path.sep) ? dir : dir + path.sep));

	for (const serviceDir of serviceDirs) {
		ignoreByDir[serviceDir] = await getDockerIgnoreInstance(
			path.join(projectDir, serviceDir),
		);
	}
	const files = await listFiles(projectDir);
	const dockerignoreFiles: FileStats[] = [];
	const filteredFileList = files.filter((file: FileStats) => {
		if (path.basename(file.relPath) === '.dockerignore') {
			dockerignoreFiles.push(file);
		}
		for (const dir of serviceDirs) {
			if (file.relPath.startsWith(dir)) {
				return !ignoreByDir[dir].ignores(file.relPath.substring(dir.length));
			}
		}
		return !ignoreByDir['.'].ignores(file.relPath);
	});
	return { filteredFileList, dockerignoreFiles };
}
