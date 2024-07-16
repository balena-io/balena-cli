/*
Copyright 2016-2021 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { InitializeEmitter, OperationState } from 'balena-device-init';
import type * as BalenaSdk from 'balena-sdk';

import _ from 'lodash';
import { promisify } from 'util';

import { getBalenaSdk, getChalk, getVisuals } from './lazy.js';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

export function getGroupDefaults(group: {
	options: Array<{ name: string; default: string | number }>;
}): { [name: string]: string | number | undefined } {
	return _.chain(group)
		.get('options')
		.map((question) => [question.name, question.default])
		.fromPairs()
		.value();
}

export function stateToString(state: OperationState) {
	const percentage = _.padStart(`${state.percentage}`, 3, '0');
	const chalk = getChalk();
	const result = `${chalk.blue(percentage + '%')} ${chalk.cyan(
		state.operation.command,
	)}`;

	switch (state.operation.command) {
		case 'copy':
			return `${result} ${state.operation.from.path} -> ${state.operation.to.path}`;
		case 'replace':
			return `${result} ${state.operation.file.path}, ${state.operation.copy} -> ${state.operation.replace}`;
		case 'run-script':
			return `${result} ${state.operation.script}`;
		default:
			throw new Error(`Unsupported operation: ${state.operation.command}`);
	}
}

/**
 * Execute a child process with admin / superuser privileges, prompting the user for
 * elevation as needed, and taking care of shell-escaping arguments in a suitable way
 * for Windows and Linux/Mac.
 *
 * @param command Unescaped array of command and args to be executed. If isCLIcmd is
 * true, the command should not include the 'node' or 'balena' components, for example:
 * ['internal', 'osinit', ...]. This function will add argv[0] and argv[1] as needed
 * (taking process.pkg into account -- CLI standalone zip package), and will also
 * shell-escape the arguments as needed, taking into account the differences between
 * bash/sh and the Windows cmd.exe in relation to escape characters.
 * @param msg Optional message for the user, before the password prompt
 * @param stderr Optional stream to which stderr should be piped
 * @param isCLIcmd (default: true) Whether the command array is a balena CLI command
 * (e.g. ['internal', 'osinit', ...]), in which case process.argv[0] and argv[1] are
 * added as necessary, depending on whether the CLI is running as a standalone zip
 * package (with Node built in).
 */
export async function sudo(
	command: string[],
	{
		stderr,
		msg,
		isCLIcmd,
	}: { stderr?: NodeJS.WritableStream; msg?: string; isCLIcmd?: boolean } = {},
) {
	const { executeWithPrivileges } = await import('./sudo.js');

	if (process.platform !== 'win32') {
		console.log(
			msg ||
				'Admin privileges required: you may be asked for your computer password to continue.',
		);
	}
	isCLIcmd ??= true;
	await executeWithPrivileges(command, stderr, isCLIcmd);
}

export async function runCommand<T>(commandArgs: string[]): Promise<T> {
	const { isSubcommand } = await import('../preparser.js');
	if (await isSubcommand(commandArgs)) {
		commandArgs = [
			commandArgs[0] + ':' + commandArgs[1],
			...commandArgs.slice(2),
		];
	}

	const { run } = await import('@oclif/core');
	return run(commandArgs) as Promise<T>;
}

export async function getManifest(
	image: string,
	deviceType: string,
): Promise<BalenaSdk.DeviceTypeJson.DeviceType> {
	const init = await import('balena-device-init');
	const sdk = getBalenaSdk();
	const manifest = await init.getImageManifest(image);
	if (
		manifest != null &&
		manifest.slug !== deviceType &&
		manifest.slug !== (await sdk.models.deviceType.get(deviceType)).slug
	) {
		const { ExpectedError } = await import('../errors.js');
		throw new ExpectedError(
			`The device type of the provided OS image ${manifest.slug}, does not match the expected device type ${deviceType}`,
		);
	}
	return (
		manifest ??
		(await sdk.models.config.getDeviceTypeManifestBySlug(deviceType))
	);
}

export const areDeviceTypesCompatible = async (
	appDeviceTypeSlug: string,
	osDeviceTypeSlug: string,
) => {
	if (appDeviceTypeSlug === osDeviceTypeSlug) {
		return true;
	}
	const sdk = getBalenaSdk();
	const pineOptions = {
		$select: 'is_of__cpu_architecture',
		$expand: {
			is_of__cpu_architecture: {
				$select: 'slug',
			},
		},
	} satisfies BalenaSdk.PineOptions<BalenaSdk.DeviceType>;
	const [appDeviceType, osDeviceType] = await Promise.all(
		[appDeviceTypeSlug, osDeviceTypeSlug].map(
			(dtSlug) =>
				sdk.models.deviceType.get(dtSlug, pineOptions) as Promise<
					BalenaSdk.PineTypedResult<BalenaSdk.DeviceType, typeof pineOptions>
				>,
		),
	);
	return sdk.models.os.isArchitectureCompatibleWith(
		osDeviceType.is_of__cpu_architecture[0].slug,
		appDeviceType.is_of__cpu_architecture[0].slug,
	);
};

export async function osProgressHandler(step: InitializeEmitter) {
	step.on('stdout', process.stdout.write.bind(process.stdout));
	step.on('stderr', process.stderr.write.bind(process.stderr));

	step.on('state', function (state) {
		if (state.operation.command === 'burn') {
			return;
		}
		console.log(exports.stateToString(state));
	});

	const visuals = getVisuals();
	const progressBars = {
		write: new visuals.Progress('Writing Device OS'),
		check: new visuals.Progress('Validating Device OS'),
	};

	step.on('burn', (state) => progressBars[state.type].update(state));

	await new Promise((resolve, reject) => {
		step.on('error', reject);
		step.on('end' as any, resolve);
	});
}

export async function getAppWithArch(applicationName: string) {
	const { getApplication } = await import('./sdk.js');
	const balena = getBalenaSdk();
	const app = await getApplication(balena, applicationName, {
		$expand: {
			application_type: {
				$select: ['name', 'slug', 'supports_multicontainer'],
			},
			is_for__device_type: {
				$select: 'slug',
				$expand: {
					is_of__cpu_architecture: {
						$select: 'slug',
					},
				},
			},
		},
	});
	return {
		...app,
		arch: app.is_for__device_type[0].is_of__cpu_architecture[0].slug,
	};
}

const second = 1000; // 1000 milliseconds
const minute = 60 * second;
export const delay = promisify(setTimeout);

/**
 * Call `func`, and if func() throws an error or returns a promise that
 * eventually rejects, retry it `times` many times, each time printing a log
 * message including the given `label` and the error that led to retrying.
 * Wait initialDelayMs before the first retry. Before each further retry,
 * the delay is reduced by the time elapsed since the last retry, and
 * increased by multiplying the result by backoffScaler.
 * @param func: The function to call and, if needed, retry calling
 * @param maxAttempts: How many times (max) to try calling func().
 * func() will always be called at least once.
 * @param label: Label to include in the retry log message
 * @param initialDelayMs: How long to wait before the first retry
 * @param backoffScaler: Multiplier to previous wait time
 * @param maxSingleDelayMs: Maximum interval between retries
 */
export async function retry<T>({
	func,
	maxAttempts,
	label,
	initialDelayMs = 1000,
	backoffScaler = 2,
	maxSingleDelayMs = 1 * minute,
}: {
	func: () => T;
	maxAttempts: number;
	label: string;
	initialDelayMs?: number;
	backoffScaler?: number;
	maxSingleDelayMs?: number;
}): Promise<T> {
	const { SIGINTError } = await import('../errors.js');
	let delayMs = initialDelayMs;
	for (let count = 0; count < maxAttempts - 1; count++) {
		const lastAttemptMs = Date.now();
		try {
			return await func();
		} catch (err) {
			// Don't retry on SIGINT (CTRL-C)
			if (err instanceof SIGINTError) {
				throw err;
			}
			if (count) {
				// use Math.max to work around system time changes, e.g. DST
				const elapsedMs = Math.max(0, Date.now() - lastAttemptMs);
				// reduce delayMs by the time elapsed since the last attempt
				delayMs = Math.max(initialDelayMs, delayMs - elapsedMs);
				// increase delayMs by the backoffScaler factor
				delayMs = Math.min(maxSingleDelayMs, delayMs * backoffScaler);
			}
			const sec = delayMs / 1000;
			const secStr = sec < 10 ? sec.toFixed(1) : Math.round(sec).toString();
			console.log(
				`Retrying "${label}" after ${secStr}s (${count + 1} of ${
					maxAttempts - 1
				}) due to: ${err}`,
			);
			await delay(delayMs);
		}
	}
	return await func();
}

/**
 * Return a compare(a, b) function suitable for use as the argument for the
 * sort() method of an array. That function will use the given manuallySortedArray
 * as "sorting guidance":
 *   - If both a and b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will follow that ordering.
 *   - If neither a nor b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will compare a and b using the standard '<' and
 *     '>' Javascript operators.
 *   - If only a or only b are found in the manuallySortedArray, the returned
 *     compare(a, b) function will treat the element that was found as being
 *     "smaller than" the not-found element (i.e. found elements appear before
 *     not-found elements in sorted order).
 *
 * The equalityFunc(a, x) argument is a function used to compare the items
 * being sorted against the items in the manuallySortedArray. For example, if
 * equalityFunc was (a, x) => a.startsWith(x), where a is an item being sorted
 * and x is an item in the manuallySortedArray, then the manuallySortedArray
 * could contain prefix substrings to guide the sorting.
 *
 * @param manuallySortedArray A pre-sorted array to guide the sorting
 * @param equalityFunc An optional function used to compare the items being
 *   sorted against items in manuallySortedArray. It should return true if
 *   the two items compare equal, otherwise false. The arguments are the
 *   same as provided by the standard Javascript array.findIndex() method.
 */
export function getManualSortCompareFunction<T, U = T>(
	manuallySortedArray: U[],
	equalityFunc: (a: T, x: U, index: number, array: U[]) => boolean,
): (a: T, b: T) => number {
	return function (a: T, b: T): number {
		const indexA = manuallySortedArray.findIndex((x, index, array) =>
			equalityFunc(a, x, index, array),
		);
		const indexB = manuallySortedArray.findIndex((x, index, array) =>
			equalityFunc(b, x, index, array),
		);
		if (indexA >= 0 && indexB >= 0) {
			return indexA - indexB;
		} else if (indexA < 0 && indexB < 0) {
			return a < b ? -1 : a > b ? 1 : 0;
		} else {
			return indexA < 0 ? 1 : -1;
		}
	};
}

/**
 * Decide whether the current shell (that executed the CLI process) is a Windows
 * 'cmd.exe' shell, including PowerShell, by checking a few environment
 * variables.
 */
export function isWindowsComExeShell() {
	return (
		// neither bash nor sh (e.g. not MSYS, MSYS2, Cygwin, WSL)
		process.env.SHELL == null &&
		// Windows cmd.exe or PowerShell
		process.env.ComSpec != null &&
		process.env.ComSpec.endsWith('cmd.exe')
	);
}

/**
 * Shell argument escaping compatible with sh, bash and Windows cmd.exe.
 * @param arg Arguments to be escaped
 * @param detectShell Whether to use the SHELL and ComSpec environment
 * variables to determine the shell type (sh / bash / cmd.exe). This may be
 * useful to detect MSYS / MSYS2, which use bash on Windows. However, if the
 * purpose is to use child_process.spawn(..., {shell: true}) and related
 * functions, set this to false because child_process.spawn() always uses
 * env.ComSpec (cmd.exe) on Windows, even when running on MSYS / MSYS2.
 */
export function shellEscape(args: string[], detectShell = false): string[] {
	const isCmdExe = detectShell
		? isWindowsComExeShell()
		: process.platform === 'win32';
	if (isCmdExe) {
		return args.map((v) => windowsCmdExeEscapeArg(v));
	} else {
		const shellEscapeFunc: typeof import('shell-escape') = require('shell-escape');
		return args.map((v) => shellEscapeFunc([v]));
	}
}

/**
 * Escape a string argument to be passed through the Windows cmd.exe shell.
 * cmd.exe escaping has some peculiarities, like using the caret character
 * instead of a backslash for reserved / metacharacters. Reference:
 * https://blogs.msdn.microsoft.com/twistylittlepassagesallalike/2011/04/23/everyone-quotes-command-line-arguments-the-wrong-way/
 */
function windowsCmdExeEscapeArg(arg: string): string {
	// if it is already double quoted, remove the double quotes
	if (arg.length > 1 && arg.startsWith('"') && arg.endsWith('"')) {
		arg = arg.slice(1, -1);
	}
	// escape cmd.exe metacharacters with the '^' (caret) character
	arg = arg.replace(/[()%!^<>&|]/g, '^$&');
	// duplicate internal double quotes, and double quote overall
	return `"${arg.replace(/["]/g, '""')}"`;
}

export interface ProxyConfig {
	host: string;
	port: string;
	username?: string;
	password?: string;
	proxyAuth?: string;
}

/**
 * Check whether a proxy has been configured (whether global-tunnel-ng or
 * global-agent) and if so, return a ProxyConfig object.
 */
export function getProxyConfig(): ProxyConfig | undefined {
	const tunnelNgConfig: any = (global as any).PROXY_CONFIG;
	// global-tunnel-ng
	if (tunnelNgConfig) {
		let username: string | undefined;
		let password: string | undefined;
		const proxyAuth: string = tunnelNgConfig.proxyAuth;
		if (proxyAuth) {
			const i = proxyAuth.lastIndexOf(':');
			if (i > 0) {
				username = proxyAuth.substring(0, i);
				password = proxyAuth.substring(i + 1);
			}
		}
		return {
			host: tunnelNgConfig.host,
			port: `${tunnelNgConfig.port}`,
			username,
			password,
			proxyAuth: tunnelNgConfig.proxyAuth,
		};
		// global-agent, or no proxy config
	} else {
		const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
		if (proxyUrl) {
			const { URL } = require('url') as typeof import('url');
			let url: URL;
			try {
				url = new URL(proxyUrl);
			} catch (_e) {
				return;
			}
			return {
				host: url.hostname,
				port: url.port,
				username: url.username,
				password: url.password,
				proxyAuth:
					url.username && url.password
						? `${url.username}:${url.password}`
						: undefined,
			};
		}
	}
}

export const expandForAppName = {
	$expand: {
		belongs_to__application: { $select: ['app_name', 'slug'] },
		is_of__device_type: { $select: 'slug' },
		is_running__release: { $select: 'commit' },
	},
} satisfies BalenaSdk.PineOptions<BalenaSdk.Device>;

/**
 * Use the `readline` library on Windows to install SIGINT handlers.
 * This appears to be necessary on MSYS / Git for Windows, and also useful
 * with PowerShell to avoid the built-in "Terminate batch job? (Y/N)" prompt
 * that appears to result in ungraceful / abrupt process termination.
 */
const installReadlineSigintEmitter = _.once(function emitSigint() {
	if (process.platform === 'win32') {
		const readline = require('readline') as typeof import('readline');
		const rl = readline.createInterface({
			input: process.stdin,
			output: process.stdout,
		});
		rl.on('SIGINT', () => process.emit('SIGINT' as any));
	}
});

/**
 * Centralized cross-platform logic to install a SIGINT handler
 * @param sigintHandler The handler function
 * @param once Whether the handler should be called no more than once
 */
export function addSIGINTHandler(sigintHandler: () => void, once = true) {
	installReadlineSigintEmitter();
	if (once) {
		process.once('SIGINT', sigintHandler);
	} else {
		process.on('SIGINT', sigintHandler);
	}
}

/**
 * Call the given task function (which returns a promise) with the given
 * arguments, await the returned promise and resolve to the same result.
 * While awaiting for that promise, also await for a SIGINT signal (if any),
 * with a new SIGINT handler that is automatically removed on return.
 * If a SIGINT signal is received while awaiting for the task function,
 * immediately return a promise that rejects with SIGINTError.
 * @param task An async function to be executed and awaited
 * @param theArgs Arguments to be passed to the task function
 */
export async function awaitInterruptibleTask<
	T extends (...args: any[]) => Promise<any>,
>(task: T, ...theArgs: Parameters<T>): Promise<ReturnType<T>> {
	let sigintHandler: () => void = () => undefined;
	const sigintPromise = new Promise<T>((_resolve, reject) => {
		sigintHandler = () => {
			const { SIGINTError } =
				require('../errors.js') as typeof import('../errors.js');
			reject(new SIGINTError('Task aborted on SIGINT signal'));
		};
		addSIGINTHandler(sigintHandler);
	});
	try {
		return await Promise.race([sigintPromise, task(...theArgs)]);
	} finally {
		process.removeListener('SIGINT', sigintHandler);
	}
}

/**
 * Pick object fields like lodash _.pick(), but also interpret "renaming
 * specifications" for object keys such as "appName => fleetName" as used
 * by the 'resin-cli-visuals' package.
 *
 * Sample input:  ({ 'a': 1, 'b': 2, 'c': 3 }, ['b => x', 'c', 'd'])
 * Sample output: { 'x': 2, 'c': 3 }
 */
export function pickAndRename<T extends Dictionary<any>>(
	obj: T,
	fields: string[],
): Dictionary<any> {
	const rename: Dictionary<any> = {};
	// map 'a => b' to 'a' and setup rename['a'] = 'b'
	fields = fields.map((f) => {
		let renameFrom = f;
		let renameTo = f;
		const match = f.match(/(?<from>\S+)\s+=>\s+(?<to>\S+)/);
		if (match && match.groups) {
			renameFrom = match.groups.from;
			renameTo = match.groups.to;
		}
		rename[renameFrom] = renameTo;
		return renameFrom;
	});
	return _.mapKeys(_.pick(obj, fields), (_val, key) => rename[key]);
}
