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
import * as Bluebird from 'bluebird';
import * as filehound from 'filehound';
import * as fs from 'fs-extra';
import * as path from 'path';
import { exec as execPkg } from 'pkg';

const ROOT = path.join(__dirname, '..');

console.log('Building package...\n');

execPkg(['--target', 'host', '--output', 'build-bin/balena', 'package.json'])
	.then(() => {
		const xpaths: Array<[string, string[]]> = [
			// [platform, [path, to, file]]
			['*', ['opn', 'xdg-open']],
			['darwin', ['denymount', 'bin', 'denymount']],
		];
		return Bluebird.map(xpaths, ([platform, xpath]) => {
			if (platform === '*' || platform === process.platform) {
				// eg copy from node_modules/opn/xdg-open to build-bin/xdg-open
				return fs.copy(
					path.join(ROOT, 'node_modules', ...xpath),
					path.join(ROOT, 'build-bin', xpath.pop()!),
				);
			}
		}).return();
	})
	.then(() => {
		return filehound
			.create()
			.paths(path.join(ROOT, 'node_modules'))
			.ext(['node', 'dll'])
			.find();
	})
	.then(nativeExtensions => {
		console.log(`\nCopying to build-bin:\n${nativeExtensions.join('\n')}`);

		return nativeExtensions.map((extPath: string) => {
			return fs.copy(
				extPath,
				extPath.replace(
					path.join(ROOT, 'node_modules'),
					path.join(ROOT, 'build-bin'),
				),
			);
		});
	});
