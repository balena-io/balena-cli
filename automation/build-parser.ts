/**
 * @license
 * Copyright 2026 Balena Ltd.
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

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

import { ROOT, which } from './utils';

/**
 * Build the Go binary that @balena/compose-parser runs. The package builds it
 * in a postinstall script, but npm 11 skips install scripts that have not been
 * approved, and the release binary is not published for the runtime build. So
 * the binary is built here, on every platform, with the Go toolchain on PATH.
 * GOTOOLCHAIN=auto lets Go fetch the toolchain the parser's go.mod asks for.
 */
export async function buildComposeParser(): Promise<void> {
	const parserDir = path.join(
		ROOT,
		'node_modules',
		'@balena',
		'compose-parser',
	);
	const goModPath = path.join(parserDir, 'lib', 'go.mod');
	if (!fs.existsSync(goModPath)) {
		throw new Error(`${goModPath} not found. Run npm install first.`);
	}

	const go = await which('go');
	const binDir = path.join(parserDir, 'bin');
	const exeName = `balena-compose-parser${process.platform === 'win32' ? '.exe' : ''}`;
	const binPath = path.join(binDir, exeName);
	fs.mkdirSync(binDir, { recursive: true });

	const args = [
		'build',
		'-C',
		path.join(parserDir, 'lib'),
		'-ldflags=-s -w',
		'-o',
		binPath,
		'.',
	];
	await new Promise<void>((resolve, reject) => {
		spawn(go, args, {
			cwd: parserDir,
			env: { ...process.env, CGO_ENABLED: '0' },
			stdio: 'inherit',
		})
			.on('error', reject)
			.on('close', (code) => {
				if (code === 0) {
					resolve();
				} else {
					reject(new Error(`go build failed with exit code ${code}`));
				}
			});
	});
	console.log(`Built ${binPath}`);
}
