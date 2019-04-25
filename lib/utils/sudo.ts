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
import { spawn, StdioOptions } from 'child_process';

import * as Bluebird from 'bluebird';
import * as rindle from 'rindle';

export async function executeWithPrivileges(
	command: string[],
	stderr?: NodeJS.WritableStream,
): Promise<string> {
	const stdio: StdioOptions = [
		'inherit',
		'inherit',
		stderr ? 'pipe' : 'inherit',
	];
	const opts = {
		env: process.env,
		stdio,
	};

	const args = process.argv
		.slice(0, 2)
		.concat(['internal', 'sudo', command.join(' ')]);

	const ps = spawn(args[0], args.slice(1), opts);

	if (stderr) {
		ps.stderr.pipe(stderr);
	}

	return Bluebird.fromCallback<string>(callback => rindle.wait(ps, callback));
}
