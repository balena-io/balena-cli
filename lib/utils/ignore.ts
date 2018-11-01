import * as _ from 'lodash';
import { fs } from 'mz';
import * as path from 'path';

import dockerIgnore = require('@zeit/dockerignore');
import ignore from 'ignore';

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
		const baseDir = path.dirname(relFile).split(path.sep)[0];
		if (baseDir === '.balena' || baseDir === '.resin') {
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
	};

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
