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

import intercept = require('intercept-stdout');
import * as _ from 'lodash';
import * as nock from 'nock';
import * as path from 'path';

import * as balenaCLI from '../build/app';
import { configureBluebird } from '../build/app-common';

configureBluebird();

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
			!log.startsWith('[debug]') &&
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

export function cleanOutput(output: string[] | string) {
	return _(_.castArray(output))
		.map(log => {
			return log.split('\n').map(line => {
				return line.trim();
			});
		})
		.flatten()
		.compact()
		.value();
}
