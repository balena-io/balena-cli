/*
Copyright 2016-2020 Balena

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
import { spawn, SpawnOptions } from 'child_process';
import * as _ from 'lodash';
import * as os from 'os';
import type * as ShellEscape from 'shell-escape';

import type { Device, PineOptions } from 'balena-sdk';
import { ExpectedError } from '../errors';
import { getBalenaSdk, getChalk, getVisuals } from './lazy';
import { promisify } from 'util';
import { isSubcommand } from '../preparser';

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
	const { executeWithPrivileges } = await import('./sudo');

	if (os.platform() !== 'win32') {
		console.log(
			msg ||
				'Admin privileges required: you may be asked for your computer password to continue.',
		);
	}
	isCLIcmd ??= true;
	await executeWithPrivileges(command, stderr, isCLIcmd);
}

export function runCommand<T>(commandArgs: string[]): Promise<T> {
	if (isSubcommand(commandArgs)) {
		commandArgs = [
			commandArgs[0] + ':' + commandArgs[1],
			...commandArgs.slice(2),
		];
	}
	const { run } = require('@oclif/command');
	return run(commandArgs);
}

export async function getManifest(
	image: string,
	deviceType: string,
): Promise<BalenaSdk.DeviceTypeJson.DeviceType> {
	const init = await import('balena-device-init');
	const manifest = await init.getImageManifest(image);
	if (manifest != null) {
		return manifest;
	}
	return getBalenaSdk().models.device.getManifestBySlug(deviceType);
}

export const areDeviceTypesCompatible = (
	appDeviceType: BalenaSdk.DeviceTypeJson.DeviceType,
	osDeviceType: BalenaSdk.DeviceTypeJson.DeviceType,
) =>
	getBalenaSdk().models.os.isArchitectureCompatibleWith(
		osDeviceType.arch,
		appDeviceType.arch,
	) && !!appDeviceType.isDependent === !!osDeviceType.isDependent;

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
		step.on('end', resolve);
	});
}

export function getAppWithArch(
	applicationName: string,
): Promise<ApplicationWithDeviceType & { arch: string }> {
	return Promise.all([
		getApplication(applicationName),
		getBalenaSdk().models.config.getDeviceTypes(),
	]).then(function ([app, deviceTypes]) {
		const config = _.find<BalenaSdk.DeviceTypeJson.DeviceType>(deviceTypes, {
			slug: app.is_for__device_type[0].slug,
		});

		if (!config) {
			throw new Error('Could not read application information!');
		}

		return { ...app, arch: config.arch };
	});
}

// TODO: Drop this. The sdk now has this baked in application.get().
function getApplication(
	applicationName: string,
): Promise<ApplicationWithDeviceType> {
	// Check for an app of the form `user/application`, and send
	// that off to a special handler (before importing any modules)
	const match = applicationName.split('/');

	const extraOptions: BalenaSdk.PineOptions<BalenaSdk.Application> = {
		$expand: {
			application_type: {
				$select: ['name', 'slug', 'supports_multicontainer', 'is_legacy'],
			},
			is_for__device_type: {
				$select: 'slug',
			},
		},
	};

	const balena = getBalenaSdk();
	if (match.length > 1) {
		return balena.models.application.getAppByOwner(
			match[1],
			match[0],
			extraOptions,
		) as Promise<ApplicationWithDeviceType>;
	}

	return balena.models.application.get(
		applicationName,
		extraOptions,
	) as Promise<ApplicationWithDeviceType>;
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
	let delayMs = initialDelayMs;
	for (let count = 0; count < maxAttempts - 1; count++) {
		const lastAttemptMs = Date.now();
		try {
			return await func();
		} catch (err) {
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
		const shellEscapeFunc: typeof ShellEscape = require('shell-escape');
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

/**
 * Error handling wrapper around the npm `which` package:
 * "Like the unix which utility. Finds the first instance of a specified
 * executable in the PATH environment variable. Does not cache the results,
 * so hash -r is not needed when the PATH changes."
 *
 * @param program Basename of a program, for example 'ssh'
 * @param rejectOnMissing If the program cannot be found, reject the promise
 * with an ExpectedError instead of fulfilling it with an empty string.
 * @returns The program's full path, e.g. 'C:\WINDOWS\System32\OpenSSH\ssh.EXE'
 */
export async function which(
	program: string,
	rejectOnMissing = true,
): Promise<string> {
	const whichMod = await import('which');
	let programPath: string;
	try {
		programPath = await whichMod(program);
	} catch (err) {
		if (err.code === 'ENOENT') {
			if (rejectOnMissing) {
				throw new ExpectedError(
					`'${program}' program not found. Is it installed?`,
				);
			} else {
				return '';
			}
		}
		throw err;
	}
	return programPath;
}

/**
 * Call which(programName) and spawn() with the given arguments.
 *
 * If returnExitCodeOrSignal is true, the returned promise will resolve to
 * an array [code, signal] with the child process exit code number or exit
 * signal string respectively (as provided by the spawn close event).
 *
 * If returnExitCodeOrSignal is false, the returned promise will reject with
 * a custom error if the child process returns a non-zero exit code or a
 * non-empty signal string (as reported by the spawn close event).
 *
 * In either case and if spawn itself emits an error event or fails synchronously,
 * the returned promise will reject with a custom error that includes the error
 * message of spawn's error.
 */
export async function whichSpawn(
	programName: string,
	args: string[],
	options: SpawnOptions = { stdio: 'inherit' },
	returnExitCodeOrSignal = false,
): Promise<[number | undefined, string | undefined]> {
	const program = await which(programName);
	if (process.env.DEBUG) {
		console.error(`[debug] [${program}, ${args.join(', ')}]`);
	}
	let error: Error | undefined;
	let exitCode: number | undefined;
	let exitSignal: string | undefined;
	try {
		[exitCode, exitSignal] = await new Promise((resolve, reject) => {
			spawn(program, args, options)
				.on('error', reject)
				.on('close', (code, signal) => resolve([code, signal]));
		});
	} catch (err) {
		error = err;
	}
	if (error || (!returnExitCodeOrSignal && (exitCode || exitSignal))) {
		const msg = [
			`${programName} failed with exit code=${exitCode} signal=${exitSignal}:`,
			`[${program}, ${args.join(', ')}]`,
			...(error ? [`${error}`] : []),
		];
		throw new Error(msg.join('\n'));
	}
	return [exitCode, exitSignal];
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

export const expandForAppName: PineOptions<Device> = {
	$expand: {
		belongs_to__application: { $select: 'app_name' },
		is_of__device_type: { $select: 'slug' },
		is_running__release: { $select: 'commit' },
	},
};
