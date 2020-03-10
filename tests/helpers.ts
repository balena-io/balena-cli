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
import * as nock from 'nock';
import * as path from 'path';

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

/**
 * Dynamic template string resolution.
 * Usage example:
 *     const templateString = 'hello ${name}!';
 *     const templateVars = { name: 'world' };
 *     console.log( fillTemplate(templateString, templateVars) );
 *     // hello world!
 */
export function fillTemplate(
	templateString: string,
	templateVars: object,
): string {
	const escaped = templateString.replace(/\\/g, '\\\\').replace(/`/g, '\\`');
	const resolved = new Function(
		...Object.keys(templateVars),
		`return \`${escaped}\`;`,
	).call(null, ...Object.values(templateVars));
	const unescaped = resolved.replace(/\\`/g, '`').replace(/\\\\/g, '\\');
	return unescaped;
}

export function fillTemplateArray(
	templateStringArray: string[],
	templateVars: object,
): string[];
export function fillTemplateArray(
	templateStringArray: Array<string | string[]>,
	templateVars: object,
): Array<string | string[]>;
export function fillTemplateArray(
	templateStringArray: Array<string | string[]>,
	templateVars: object,
): Array<string | string[]> {
	return templateStringArray.map(i =>
		Array.isArray(i)
			? fillTemplateArray(i, templateVars)
			: fillTemplate(i, templateVars),
	);
}
