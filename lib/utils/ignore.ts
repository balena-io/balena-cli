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
import { fs } from 'mz';
import * as os from 'os';
import * as path from 'path';
import * as MultiBuild from 'resin-multibuild';
import { Transform } from 'stream';

import ignore from 'ignore';

import { exitWithExpectedError } from './patterns';

const { toPosixPath } = MultiBuild.PathUtils;

type KlawItem = import('klaw').Item;
export interface KlawItemPlus extends KlawItem {
	data?: Buffer;
}

export enum IgnoreFileType {
	DockerIgnore,
	GitIgnore,
}

interface IgnoreEntry {
	pattern: string;
	// The relative file path from the base path of the build context
	filePath: string;
}

export class FileIgnorer {
	private dockerIgnoreEntries: IgnoreEntry[];
	private gitIgnoreEntries: IgnoreEntry[];
	private hasWarnedAboutGitignore = false;

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
				if (
					!this.hasWarnedAboutGitignore &&
					type === IgnoreFileType.GitIgnore
				) {
					this.hasWarnedAboutGitignore = true;
					console.error(`\n${require('./messages').gitignoreWarn}`);
				}
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

		contents.split('\n').forEach(line => {
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

		const dockerIgnoreHandle = require('@zeit/dockerignore')();
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

const defaultDockerIgnoreEntries = ['.git'];
const dockerIgnoreMsg = `\
Starting with version 11.9.0, the CLI checks for the existence of a ".dockerignore"
file containing recommended or required patterns. By default, the following patterns
are expected at a minimum:

${defaultDockerIgnoreEntries.join(os.EOL)}

If you have specific requirements, you may modify the patterns above by adding or
removing the '!' or '#' characters at the beginning of the line. These characters
respectively "invert the matching" or "comment out" the pattern. Even if modified
in this manner, the presence of the patterns in the .dockerignore file will be
sufficient to satisfy the CLI's check and suppress this warning message.`;

/**
 * Check a ".dockerignore" file for required entries, and print warning messages.
 * Each pattern line is compared disregarding the first character if it is a
 * '!' or '#', because the user is allowed to modify the patterns by respectively
 * inverting them or commenting them out.
 * @param projectDir The project source folder ('-s' command-line option)
 * @param defaultEntries Array of required .dockerignore pattern lines
 */
export async function checkDockerIgnoreFile(
	projectDir: string,
	defaultEntries: string[] = defaultDockerIgnoreEntries,
) {
	const dockerIgnorePath = path.join(projectDir, '.dockerignore');
	if (!(await fs.exists(dockerIgnorePath))) {
		const msg = `\
--------------------------------------------------------------------------------
Warning: a ".dockerignore" file was not found at "${projectDir}".

${dockerIgnoreMsg}

If a ".gitignore" file exists, its contents can be used as a starting point for
the ".dockerignore" file. There are however subtle differences in how the patterns
are interpreted between the .gitignore and .dockerignore files, and you are
encouraged to review the patterns to suit your project. Dockerignore reference:
https://docs.docker.com/engine/reference/builder/#dockerignore-file
--------------------------------------------------------------------------------`;
		console.error(msg);
		return;
	}

	// Check the ".dockerignore" file for required entries. Each pattern line is compared
	// disregarding the first character if it is a '!' or '#', because the user is allowed
	// to modify the patterns by respectively inverting them or commenting them out.

	let dockerIgnoreStr: string;
	try {
		dockerIgnoreStr = await fs.readFile(dockerIgnorePath, 'utf8');
	} catch (err) {
		return exitWithExpectedError(
			`Error reading file ${dockerIgnorePath}: ${err.message}`,
		);
	}
	const dockerIgnoreLines: string[] = dockerIgnoreStr
		.split('\n') // also OK if the separator is '\r\n' (Windows CR-LF)
		.map(v => v.trim());
	const dockerIgnoreLinesMinusPrefix: string[] = dockerIgnoreLines.map(v =>
		v.startsWith('!') || v.startsWith('#') ? v.slice(1) : v,
	);
	const missingEntries = defaultEntries.filter(v => {
		v = v.startsWith('!') ? v.slice(1) : v;
		return !_.some(dockerIgnoreLinesMinusPrefix, p => p === v);
	});

	if (missingEntries.length) {
		const entriesAre = missingEntries.length === 1 ? 'entry is' : 'entries are';
		const msg = `\
--------------------------------------------------------------------------------
Warning: the following ${entriesAre} missing in the ".dockerignore" file:

${missingEntries.join(os.EOL)}

${dockerIgnoreMsg}
--------------------------------------------------------------------------------`;
		console.error(msg);
	}
}

/**
 * Create and return a Transform stream suitable for a '.pipe(stream)' operation,
 * for use with the 'klaw' package. The stream will use a '.dockerignore' file
 * (if any) to filter out files and folders.
 * @param projectDir The project source folder ('-s' command-line option)
 */
export async function getKlawStreamFilterForDockerIgnore(
	projectDir: string,
): Promise<Transform> {
	const dockerIgnorePath = path.join(projectDir, '.dockerignore');
	let dockerIgnoreStr = '';
	try {
		dockerIgnoreStr = await fs.readFile(dockerIgnorePath, 'utf8');
	} catch (err) {
		if (err.code !== 'ENOENT') {
			return exitWithExpectedError(
				`Error reading file "${dockerIgnorePath}": ${err.message}`,
			);
		}
	}
	const through2 = await import('through2');
	const dockerIgnore = require('@zeit/dockerignore')();
	if (dockerIgnoreStr) {
		dockerIgnore.add(dockerIgnoreStr);
	}
	// Note: expressing the .balena metadata rule as a dockignore pattern
	// fails because of a bug: https://github.com/zeit/dockerignore/issues/15
	// dockerIgnore.add(['!**/.balena', '!**/.resin']);

	return through2.obj(async function(item: KlawItemPlus, _enc, next) {
		// directory entries are not added to the tar stream. Directories are
		// implied from the paths of file entries.
		if (item.stats.isDirectory()) {
			return next();
		}
		const relPath = path.relative(projectDir, item.path);
		const posixRelPath = toPosixPath(relPath);
		try {
			// Don't ignore any metadata files (.balena folder).
			// The regex below matches `.balena/qemu` and `myservice/.balena/qemu`
			// but not `some.dir.for.balena/qemu`.
			if (
				/(^|\/)\.(balena|resin)\//.test(posixRelPath) ||
				!dockerIgnore.ignores(relPath)
			) {
				item.data = await fs.readFile(item.path);
				item.path = posixRelPath;
				this.push(item);
			}
		} catch (err) {
			return exitWithExpectedError(
				`Error reading file "${item.path}": ${err.message}`,
			);
		}
		next();
	});
}
