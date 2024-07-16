/**
 * @license
 * Copyright 2019-2021 Balena Ltd.
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
import * as path from 'path';

import packageJSON from '../package.json' with { type: 'json' };
import { getNodeEngineVersionWarn } from '../lib/utils/messages.js';
import { warnify } from '../lib/utils/messages.js';

const balenaExe = process.platform === 'win32' ? 'balena.exe' : 'balena';
const standalonePath = path.resolve(
	import.meta.dirname,
	'..',
	'build-bin',
	balenaExe,
);

export interface TestOutput {
	err: string[]; // stderr
	out: string[]; // stdout
	exitCode?: string | number; // process.exitCode
}

function matchesNodeEngineVersionWarn(msg: string) {
	if (/^-----+\r?\n?$/.test(msg)) {
		return true;
	}
	const cleanup = (line: string): string[] =>
		line
			.replace(/-----+/g, '')
			.replace(/"\d+\.\d+\.\d+"/, '"x.y.z"')
			.split(/\r?\n/)
			.map((l) => l.trim())
			.filter((l) => l);

	let nodeEngineWarn: string = getNodeEngineVersionWarn(
		'x.y.z',
		packageJSON.engines.node,
	);
	const nodeEngineWarnArray = cleanup(nodeEngineWarn);
	nodeEngineWarn = nodeEngineWarnArray.join('\n');
	msg = cleanup(msg).join('\n');
	return msg === nodeEngineWarn || nodeEngineWarnArray.includes(msg);
}

/**
 * Filter stdout / stderr lines to remove lines that start with `[debug]` and
 * other lines that can be ignored for testing purposes.
 * @param testOutput
 */
export function filterCliOutputForTests({
	err,
	out,
}: {
	err: string[];
	out: string[];
}): { err: string[]; out: string[] } {
	// eslint-disable-next-line no-control-regex
	const unicodeCharacterEscapesRegex = /\u001b\[3[0-9]m/g;
	return {
		err: err
			.map((line) => line.replaceAll(unicodeCharacterEscapesRegex, ''))
			.filter(
				(line: string) =>
					line &&
					!line.match(/\[debug\]/i) &&
					// TODO stop this warning message from appearing when running
					// sdk.setSharedOptions multiple times in the same process
					!line.startsWith('Shared SDK options') &&
					!line.startsWith('WARN: disabling Sentry.io error reporting') &&
					!matchesNodeEngineVersionWarn(line),
			),
		out: out
			.map((line) => line.replaceAll(unicodeCharacterEscapesRegex, ''))
			.filter((line) => line && !line.match(/\[debug\]/i)),
	};
}

/**
 * Run the CLI in this same process, by calling the run() function in `app.ts`.
 * @param cmd Command to execute, e.g. `push myApp` (without 'balena' prefix)
 */
async function runCommandInProcess(cmd: string): Promise<TestOutput> {
	const balenaCLI = await import('../lib/app.js');
	const { default: intercept } = await import('intercept-stdout');

	const preArgs = [process.argv[0], path.join(process.cwd(), 'bin', 'balena')];

	const err: string[] = [];
	const out: string[] = [];

	const stdoutHook = (log: string | Buffer) => {
		if (typeof log === 'string') {
			out.push(log);
		}
	};
	const stderrHook = (log: string | Buffer) => {
		if (typeof log === 'string') {
			err.push(log);
		}
	};
	const unhookIntercept = intercept(stdoutHook, stderrHook);

	try {
		await balenaCLI.run(preArgs.concat(cmd.split(' ').filter((c) => c)), {
			dir: path.resolve(import.meta.dirname, '..'),
			noFlush: true,
		});
	} finally {
		unhookIntercept();
	}
	const filtered = filterCliOutputForTests({ err, out });
	return {
		err: filtered.err,
		out: filtered.out,
		// this makes sense if `process.exit()` was stubbed with sinon
		exitCode: process.exitCode,
	};
}

/**
 * Run the command (e.g. `balena xxx args`) in a child process, instead of
 * the same process as mocha. This is slow and does not allow mocking the
 * source code, but it is useful for testing the standalone zip package binary.
 * (Every now and then, bugs surface because of missing entries in the
 * `pkg.assets` section of `package.json`, usually because of updated
 * dependencies that don't clearly declare the have compatibility issues
 * with `pkg`.)
 *
 * `mocha` runs on the parent process, and many of the tests inspect network
 * traffic intercepted with `nock`. But this interception only works in the
 * parent process itself. To get around this, we run a HTTP proxy server on
 * the parent process, and get the child process to use it (the CLI already had
 * support for proxy servers as a product feature, and this testing arrangement
 * also exercises the proxy capabilities).
 *
 * @param cmd Command to execute, e.g. `push myApp` (without 'balena' prefix)
 * @param proxyPort TCP port number for the HTTP proxy server running on the
 * parent process
 */
async function runCommandInSubprocess(
	cmd: string,
	proxyPort: number,
): Promise<TestOutput> {
	let exitCode = 0;
	let stdout = '';
	let stderr = '';
	const addedEnvs = {
		// Use http instead of https, so we can intercept and test the data,
		// for example the contents of tar streams sent by the CLI to Docker
		BALENARC_API_URL: 'http://api.balena-cloud.com',
		BALENARC_BUILDER_URL: 'http://builder.balena-cloud.com',
		BALENARC_PROXY: `http://127.0.0.1:${proxyPort}`,
		// override default proxy exclusion to allow proxying of requests to 127.0.0.1
		BALENARC_DO_PROXY: '127.0.0.1,localhost',
	};
	const { execFile } = await import('child_process');
	await new Promise<void>((resolve) => {
		const child = execFile(
			standalonePath,
			cmd.split(' ').filter((c) => c),
			{ env: { ...process.env, ...addedEnvs } },
			($error, $stdout, $stderr) => {
				stderr = $stderr || '';
				stdout = $stdout || '';
				// $error will be set if the CLI child process exits with a
				// non-zero exit code. Usually this is harmless/expected, as
				// the CLI child process is tested for error conditions.
				if ($error && process.env.DEBUG) {
					const msg = `
Error (possibly expected) executing child CLI process "${standalonePath}"
${$error}`;
					console.error(warnify(msg, '[debug] '));
				}
				resolve();
			},
		);
		child.on('exit', (code: number, signal: string) => {
			if (process.env.DEBUG) {
				console.error(
					`CLI child process exited with code=${code} signal=${signal}`,
				);
			}
			exitCode = code;
		});
	});

	const splitLines = (lines: string) =>
		lines
			.split(/[\r\n]/) // includes '\r' in isolation, used in progress bars
			.filter((l) => l)
			.map((l) => l + '\n');

	const filtered = filterCliOutputForTests({
		err: splitLines(stderr),
		out: splitLines(stdout),
	});
	return {
		err: filtered.err,
		out: filtered.out,
		// this makes sense if `process.exit()` was stubbed with sinon
		exitCode,
	};
}

/**
 * Run a CLI command and capture its stdout, stderr and exit code for testing.
 * If the BALENA_CLI_TEST_TYPE env var is set to 'standalone', then the command
 * will be executed in a separate child process, and a proxy server will be
 * started in order to intercept and test HTTP requests.
 * Otherwise, simply call the CLI's run() entry point in this same process.
 * @param cmd Command to execute, e.g. `push myApp` (without 'balena' prefix)
 */
export async function runCommand(cmd: string): Promise<TestOutput> {
	if (process.env.BALENA_CLI_TEST_TYPE === 'standalone') {
		const semver = await import('semver');
		if (semver.lt(process.version, '10.16.0')) {
			throw new Error(
				`The standalone tests require Node.js >= v10.16.0 because of net/proxy features ('global-agent' npm package)`,
			);
		}
		try {
			const { promises: fs } = await import('fs');
			await fs.access(standalonePath);
		} catch {
			throw new Error(`Standalone executable not found: "${standalonePath}"`);
		}
		const proxy = await import('./nock/proxy-server.js');
		const [proxyPort] = await proxy.createProxyServerOnce();
		return runCommandInSubprocess(cmd, proxyPort);
	} else {
		return runCommandInProcess(cmd);
	}
}

export function cleanOutput(
	output: string[] | string,
	collapseBlank = false,
): string[] {
	const cleanLine = collapseBlank
		? (line: string) => monochrome(line.trim()).replace(/\s{2,}/g, ' ')
		: (line: string) => monochrome(line.trim());

	const result: string[] = [];
	output = typeof output === 'string' ? [output] : output;
	for (const lines of output) {
		for (let line of lines.split('\n')) {
			line = cleanLine(line);
			if (line) {
				result.push(line);
			}
		}
	}
	return result;
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
	// eslint-disable-next-line no-control-regex
	return text.replace(/\u001b\[\??(\d+;)*\d+[a-zA-Z]\r?/g, '');
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

/**
 * Recursively navigate the `data` argument (if it is an array or object),
 * finding and replacing "template strings" such as 'hello ${name}!' with
 * the variable values given in `templateVars` such as { name: 'world' }.
 *
 * @param data Any data type (array, object, string) containing template
 * strings to be replaced
 * @param templateVars Map of template variable names to values
 */
export function deepTemplateReplace(
	data: any,
	templateVars: { [key: string]: any },
): any {
	switch (typeof data) {
		case 'string':
			return fillTemplate(data, templateVars);
		case 'object':
			if (Array.isArray(data)) {
				return data.map((i) => deepTemplateReplace(i, templateVars));
			}
			return _.mapValues(data, (value) =>
				deepTemplateReplace(value, templateVars),
			);
		default:
			// number, undefined, null, or something else
			return data;
	}
}

export const fillTemplateArray = deepTemplateReplace;

/**
 * Recursively navigate the `data` argument (if it is an array or object),
 * looking for strings that start with `[` or `{` which are assumed to contain
 * JSON arrays or objects that are then parsed with JSON.parse().
 * @param data
 */
export function deepJsonParse(data: any): any {
	if (typeof data === 'string') {
		const maybeJson = data.trim();
		if (maybeJson.startsWith('{') || maybeJson.startsWith('[')) {
			return JSON.parse(maybeJson);
		}
	} else if (Array.isArray(data)) {
		return data.map((i) => deepJsonParse(i));
	} else if (typeof data === 'object') {
		return _.mapValues(data, (value) => deepJsonParse(value));
	}
	return data;
}

export async function switchSentry(
	enabled: boolean | undefined,
): Promise<boolean | undefined> {
	const balenaCLI = await import('../lib/app.js');
	const sentryOpts = (await balenaCLI.setupSentry()).getClient()?.getOptions();
	if (sentryOpts) {
		const sentryStatus = sentryOpts.enabled;
		sentryOpts.enabled = enabled;
		return sentryStatus;
	}
}
