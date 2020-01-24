/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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
require('./config-tests'); // required for side effects

import intercept = require('intercept-stdout');
import * as _ from 'lodash';
import { fs } from 'mz';
import * as nock from 'nock';
import * as path from 'path';
import { PathUtils } from 'resin-multibuild';
import { Readable } from 'stream';
import * as tar from 'tar-stream';
import { streamToBuffer } from 'tar-utils';

import * as balenaCLI from '../build/app';

export const runCommand = async (cmd: string) => {
	const preArgs = [process.argv[0], path.join(process.cwd(), 'bin', 'balena')];

	const err: string[] = [];
	const out: string[] = [];

	const stdoutHook = (log: string | Buffer) => {
		// Skip over debug messages
		if (typeof log === 'string' && !log.startsWith('[debug]')) {
			out.push(log);
		}
	};
	const stderrHook = (log: string | Buffer) => {
		// Skip over debug messages
		if (
			typeof log === 'string' &&
			!log.match(/\[debug\]/i) &&
			// TODO stop this warning message from appearing when running
			// sdk.setSharedOptions multiple times in the same process
			!log.startsWith('Shared SDK options') &&
			// Node 12: '[DEP0066] DeprecationWarning: OutgoingMessage.prototype._headers is deprecated'
			!log.includes('[DEP0066]')
		) {
			err.push(log);
		}
	};
	const unhookIntercept = intercept(stdoutHook, stderrHook);

	try {
		await balenaCLI.run(preArgs.concat(cmd.split(' ')), {
			noFlush: true,
		});
		return {
			err,
			out,
		};
	} finally {
		unhookIntercept();
	}
};

export const balenaAPIMock = () => {
	if (!nock.isActive()) {
		nock.activate();
	}

	return nock(/./)
		.get('/config/vars')
		.reply(200, {
			reservedNames: [],
			reservedNamespaces: [],
			invalidRegex: '/^d|W/',
			whiteListedNames: [],
			whiteListedNamespaces: [],
			blackListedNames: [],
			configVarSchema: [],
		});
};

export function cleanOutput(output: string[] | string): string[] {
	return _(_.castArray(output))
		.map((log: string) => {
			return log.split('\n').map(line => {
				return monochrome(line.trim());
			});
		})
		.flatten()
		.compact()
		.value();
}

/**
 * Remove text colors (ASCII escape sequences). Example:
 * Input: '\u001b[2K\r\u001b[34m[Build]\u001b[39m   \u001b[1mmain\u001b[22m Image size: 1.14 MB'
 * Output: '[Build]   main Image size: 1.14 MB'
 *
 * TODO: check this function against a spec (ASCII escape sequences). It was
 * coded from observation of a few samples only, and may not cover all cases.
 */
export function monochrome(text: string): string {
	return text.replace(/\u001b\[\??\d+?[a-zA-Z]\r?/g, '');
}

export interface TarStreamFiles {
	[filePath: string]: {
		fileSize: number;
		type: tar.Headers['type'];
	};
}

/**
 * Run a few chai.expect() test assertions on a tar stream/buffer produced by
 * the balena push, build and deploy commands, intercepted at HTTP level on
 * their way from the CLI to the Docker daemon or balenaCloud builders.
 *
 * @param tarRequestBody Intercepted buffer of tar stream to be sent to builders/Docker
 * @param expectedFiles Details of files expected to be found in the buffer
 * @param projectPath Path of test project that was tarred, to compare file contents
 * @param expect chai.expect function
 */
export async function inspectTarStream(
	tarRequestBody: string | Buffer,
	expectedFiles: TarStreamFiles,
	projectPath: string,
	expect: Chai.ExpectStatic,
): Promise<void> {
	// string to stream: https://stackoverflow.com/a/22085851
	const sourceTarStream = new Readable();
	sourceTarStream._read = () => undefined;
	sourceTarStream.push(tarRequestBody);
	sourceTarStream.push(null);

	const found: TarStreamFiles = await new Promise((resolve, reject) => {
		const foundFiles: TarStreamFiles = {};
		const extract = tar.extract();
		extract.on('error', reject);
		extract.on(
			'entry',
			async (header: tar.Headers, stream: Readable, next: tar.Callback) => {
				try {
					// TODO: test the .balena folder instead of ignoring it
					if (header.name.startsWith('.balena/')) {
						stream.resume();
					} else {
						expect(foundFiles).to.not.have.property(header.name);
						foundFiles[header.name] = {
							fileSize: header.size || 0,
							type: header.type,
						};
						const [buf, buf2] = await Promise.all([
							streamToBuffer(stream),
							fs.readFile(
								path.join(projectPath, PathUtils.toNativePath(header.name)),
							),
						]);
						expect(buf.equals(buf2)).to.be.true;
					}
				} catch (err) {
					reject(err);
				}
				next();
			},
		);
		extract.once('finish', () => {
			resolve(foundFiles);
		});
		sourceTarStream.on('error', reject);
		sourceTarStream.pipe(extract);
	});

	expect(found).to.deep.equal(expectedFiles);
}
