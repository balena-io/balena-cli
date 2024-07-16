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

import type { JsonVersions } from '../lib/commands/version/index';

import { run as oclifRun } from '@oclif/core';
import archiver from 'archiver';
import Bluebird from 'bluebird';
import { exec, execFile } from 'child_process';
import filehound from 'filehound';
import type { Stats } from 'fs';
import * as fs from 'fs-extra';
import klaw from 'klaw';
import * as path from 'path';
import rimraf from 'rimraf';
import * as semver from 'semver';
import { promisify } from 'util';
import { notarize } from '@electron/notarize';

import { stripIndent } from '../lib/utils/lazy';
import { diffLines, ROOT, StdOutTap, whichSpawn } from './utils';
import { filterCliOutputForTests, monochrome } from '../tests/helpers';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

import pjson from '../package.json' with { type: 'json' };
export const packageJSON = pjson;
export const version = 'v' + packageJSON.version;
const arch = process.arch;

function dPath(...paths: string[]) {
	return path.join(ROOT, 'dist', ...paths);
}

interface PathByPlatform {
	[platform: string]: string;
}

const standaloneZips: PathByPlatform = {
	linux: dPath(`balena-cli-${version}-linux-${arch}-standalone.zip`),
	darwin: dPath(`balena-cli-${version}-macOS-${arch}-standalone.zip`),
	win32: dPath(`balena-cli-${version}-windows-${arch}-standalone.zip`),
};

const getOclifInstallersOriginalNames = async (): Promise<PathByPlatform> => {
	const { stdout } = await execAsync('git rev-parse --short HEAD');
	const sha = stdout.trim();
	return {
		darwin: dPath('macos', `balena-${version}-${sha}-${arch}.pkg`),
		win32: dPath('win32', `balena-${version}-${sha}-${arch}.exe`),
	};
};

const renamedOclifInstallers: PathByPlatform = {
	darwin: dPath(`balena-cli-${version}-macOS-${arch}-installer.pkg`),
	win32: dPath(`balena-cli-${version}-windows-${arch}-installer.exe`),
};

export const finalReleaseAssets: { [platform: string]: string[] } = {
	win32: [standaloneZips['win32'], renamedOclifInstallers['win32']],
	darwin: [standaloneZips['darwin'], renamedOclifInstallers['darwin']],
	linux: [standaloneZips['linux']],
};

/**
 * Given the output of `pkg` as a string (containing warning messages),
 * diff it against previously saved output of known "safe" warnings.
 * Throw an error if the diff is not empty.
 */
async function diffPkgOutput(pkgOut: string) {
	const relSavedPath = path.join(
		'tests',
		'test-data',
		'pkg',
		`expected-warnings-${process.platform}-${arch}.txt`,
	);
	const absSavedPath = path.join(ROOT, relSavedPath);
	const ignoreStartsWith = [
		'> pkg@',
		'> Fetching base Node.js binaries',
		'  fetched-',
		'prebuild-install WARN install No prebuilt binaries found',
	];
	const modulesRE =
		process.platform === 'win32'
			? /(?<=[ '])([A-Z]:)?\\.+?\\node_modules(?=\\)/
			: /(?<=[ '])\/.+?\/node_modules(?=\/)/;
	const buildRE =
		process.platform === 'win32'
			? /(?<=[ '])([A-Z]:)?\\.+\\build(?=\\)/
			: /(?<=[ '])\/.+\/build(?=\/)/;

	const cleanLines = (chunks: string | string[]) => {
		const lines = typeof chunks === 'string' ? chunks.split('\n') : chunks;
		return lines
			.map((line: string) => monochrome(line)) // remove ASCII colors
			.filter((line: string) => !/^\s*$/.test(line)) // blank lines
			.filter((line: string) =>
				ignoreStartsWith.every((i) => !line.startsWith(i)),
			)
			.map((line: string) => {
				// replace absolute paths with relative paths
				let replaced = line.replace(modulesRE, 'node_modules');
				if (replaced === line) {
					replaced = line.replace(buildRE, 'build');
				}
				return replaced;
			});
	};

	pkgOut = cleanLines(pkgOut).join('\n');
	const { readFile } = (await import('fs')).promises;
	const expectedOut = cleanLines(await readFile(absSavedPath, 'utf8')).join(
		'\n',
	);
	if (expectedOut !== pkgOut) {
		const sep =
			'================================================================================';
		const diff = diffLines(expectedOut, pkgOut);
		const msg = `pkg output does not match expected output from "${relSavedPath}"
Diff:
${sep}
${diff}
${sep}
Check whether the new or changed pkg warnings are safe to ignore, then update
"${relSavedPath}"
and share the result of your investigation as comments on the pull request.
Hint: the fix is often a matter of updating the 'pkg.scripts' or 'pkg.assets'
sections in the CLI's 'package.json' file, or a matter of updating the
'buildPkg' function in 'automation/build-bin.ts'.  Sometimes it requires
patching dependencies: See for example 'patches/all/open+7.0.2.patch'.
${sep}
`;
		throw new Error(msg);
	}
}

/**
 * Call `pkg.exec` to generate the standalone zip file, capturing its warning
 * messages (stdout and stderr) in order to call diffPkgOutput().
 */
async function execPkg(...args: any[]) {
	const { exec: pkgExec } = await import('@yao-pkg/pkg');
	const outTap = new StdOutTap(true);
	try {
		outTap.tap();
		await (pkgExec as any)(...args);
	} catch (err) {
		outTap.untap();
		console.log(outTap.stdoutBuf.join(''));
		console.error(outTap.stderrBuf.join(''));
		throw err;
	}
	outTap.untap();
	try {
		await diffPkgOutput(outTap.allBuf.join(''));
	} catch (err) {
		console.error('diff on pkg warnings', err);
	}
}

/**
 * Use the 'pkg' module to create a single large executable file with
 * the contents of 'node_modules' and the CLI's javascript code.
 * Also copy a number of native modules (binary '.node' files) that are
 * compiled during 'npm install' to the 'build-bin' folder, alongside
 * the single large executable file created by pkg. (This is necessary
 * because of a pkg limitation that does not allow binary executables
 * to be directly executed from inside another binary executable.)
 */
async function buildPkg() {
	// https://github.com/vercel/pkg#targets
	let targets = `linux-${arch}`;
	if (process.platform === 'darwin') {
		targets = `macos-${arch}`;
	}
	// TBC: not yet possible to build for Windows arm64 on x64 nodes
	if (process.platform === 'win32') {
		targets = `win-x64`;
	}
	const args = [
		'--targets',
		targets,
		'--output',
		'build-bin/balena',
		'package.json',
	];
	console.log('=======================================================');
	console.log(`execPkg ${args.join(' ')}`);
	console.log(`cwd="${process.cwd()}" ROOT="${ROOT}"`);
	console.log('=======================================================');

	await execPkg(args);

	const paths: Array<[string, string[], string[]]> = [
		// [platform, [source path], [destination path]]
		['*', ['open', 'xdg-open'], ['xdg-open']],
		['darwin', ['denymount', 'bin', 'denymount'], ['denymount']],
	];
	await Promise.all(
		paths.map(([platform, source, dest]) => {
			if (platform === '*' || platform === process.platform) {
				// eg copy from node_modules/open/xdg-open to build-bin/xdg-open
				return fs.copy(
					path.join(ROOT, 'node_modules', ...source),
					path.join(ROOT, 'build-bin', ...dest),
				);
			}
		}),
	);
	const nativeExtensionPaths: string[] = await filehound
		.create()
		.paths(path.join(ROOT, 'node_modules'))
		.ext(['node', 'dll'])
		.find();

	console.log(`\nCopying to build-bin:\n${nativeExtensionPaths.join('\n')}`);

	await Promise.all(
		nativeExtensionPaths.map((extPath) =>
			fs.copy(
				extPath,
				extPath.replace(
					path.join(ROOT, 'node_modules'),
					path.join(ROOT, 'build-bin'),
				),
			),
		),
	);
}

/**
 * Run some basic tests on the built pkg executable.
 * TODO: test more than just `balena version -j`; integrate with the
 * existing mocha/chai CLI command testing.
 */
async function testPkg() {
	const pkgBalenaPath = path.join(
		ROOT,
		'build-bin',
		process.platform === 'win32' ? 'balena.exe' : 'balena',
	);
	console.log(`Testing standalone package "${pkgBalenaPath}"...`);
	// Run `balena version -j`, parse its stdout as JSON, and check that the
	// reported Node.js major version matches semver.major(process.version)
	let { stdout, stderr } = await execFileAsync(pkgBalenaPath, [
		'version',
		'-j',
	]);
	const filtered = filterCliOutputForTests({
		err: stderr.split(/\r?\n/),
		out: stdout.split(/\r?\n/),
	});
	stdout = filtered.out.join('\n');
	stderr = filtered.err.join('\n');
	let pkgNodeVersion = '';
	let pkgNodeMajorVersion = 0;
	try {
		const balenaVersions: JsonVersions = JSON.parse(stdout);
		pkgNodeVersion = balenaVersions['Node.js'];
		pkgNodeMajorVersion = semver.major(pkgNodeVersion);
	} catch (err) {
		throw new Error(stripIndent`
			Error parsing JSON output of "balena version -j": ${err}
			Original output: "${stdout}"`);
	}
	if (semver.major(process.version) !== pkgNodeMajorVersion) {
		throw new Error(
			`Mismatched major version: built-in pkg Node version="${pkgNodeVersion}" vs process.version="${process.version}"`,
		);
	}
	if (filtered.err.length > 0) {
		const err = filtered.err.join('\n');
		throw new Error(`"${pkgBalenaPath}": non-empty stderr "${err}"`);
	}
	console.log('Success! (standalone package test successful)');
}

/**
 * Create the zip file for the standalone 'pkg' bundle previously created
 * by the buildPkg() function in 'build-bin.ts'.
 */
async function zipPkg() {
	const outputFile = standaloneZips[process.platform];
	if (!outputFile) {
		throw new Error(
			`Standalone installer unavailable for platform "${process.platform}"`,
		);
	}
	await fs.mkdirp(path.dirname(outputFile));
	await new Promise((resolve, reject) => {
		console.log(`Zipping standalone package to "${outputFile}"...`);

		const archive = archiver('zip', {
			zlib: { level: 7 },
		});
		archive.directory(path.join(ROOT, 'build-bin'), 'balena-cli');

		const outputStream = fs.createWriteStream(outputFile);

		outputStream.on('close', resolve);
		outputStream.on('error', reject);

		archive.on('error', reject);
		archive.on('warning', console.warn);

		archive.pipe(outputStream);
		archive.finalize().catch(reject);
	});
}

export async function signFilesForNotarization() {
	console.log('Signing files for notarization');
	if (process.platform !== 'darwin') {
		return;
	}
	console.log('Deleting unneeded zip files...');
	await new Promise((resolve, reject) => {
		klaw('node_modules/')
			.on('data', (item: { path: string; stats: Stats }) => {
				if (!item.stats.isFile()) {
					return;
				}
				if (path.basename(item.path).endsWith('.node.bak')) {
					console.log('Removing pkg .node.bak file', item.path);
					fs.unlinkSync(item.path);
				}
				if (
					path.basename(item.path).endsWith('.zip') &&
					path.dirname(item.path).includes('test')
				) {
					console.log('Removing zip', item.path);
					fs.unlinkSync(item.path);
				}
			})
			.on('end', resolve)
			.on('error', reject);
	});
	// Sign all .node files first
	console.log('Signing .node files...');
	await new Promise((resolve, reject) => {
		klaw('node_modules/')
			.on('data', async (item: { path: string; stats: Stats }) => {
				if (!item.stats.isFile()) {
					return;
				}
				if (path.basename(item.path).endsWith('.node')) {
					console.log('running command:', 'codesign', [
						'-d',
						'-f',
						'-s',
						'Developer ID Application: Balena Ltd (66H43P8FRG)',
						item.path,
					]);
					await whichSpawn('codesign', [
						'-d',
						'-f',
						'-s',
						'Developer ID Application: Balena Ltd (66H43P8FRG)',
						item.path,
					]);
				}
			})
			.on('end', resolve)
			.on('error', reject);
	});
	console.log('Signing other binaries...');
	console.log('running command:', 'codesign', [
		'-d',
		'-f',
		'--options=runtime',
		'-s',
		'Developer ID Application: Balena Ltd (66H43P8FRG)',
		'node_modules/denymount/bin/denymount',
	]);
	await whichSpawn('codesign', [
		'-d',
		'-f',
		'--options=runtime',
		'-s',
		'Developer ID Application: Balena Ltd (66H43P8FRG)',
		'node_modules/denymount/bin/denymount',
	]);
	console.log('running command:', 'codesign', [
		'-d',
		'-f',
		'--options=runtime',
		'-s',
		'Developer ID Application: Balena Ltd (66H43P8FRG)',
		'node_modules/macmount/bin/macmount',
	]);
	await whichSpawn('codesign', [
		'-d',
		'-f',
		'--options=runtime',
		'-s',
		'Developer ID Application: Balena Ltd (66H43P8FRG)',
		'node_modules/macmount/bin/macmount',
	]);
}

export async function buildStandaloneZip() {
	console.log(`Building standalone zip package for CLI ${version}`);
	try {
		await buildPkg();
		await testPkg();
		await zipPkg();
		console.log(`Standalone zip package build completed`);
	} catch (error) {
		console.error(`Error creating or testing standalone zip package`);
		throw error;
	}
}

async function renameInstallerFiles() {
	const oclifInstallers = await getOclifInstallersOriginalNames();
	if (await fs.pathExists(oclifInstallers[process.platform])) {
		await fs.rename(
			oclifInstallers[process.platform],
			renamedOclifInstallers[process.platform],
		);
	}
}

/**
 * If the CSC_LINK and CSC_KEY_PASSWORD env vars are set, digitally sign the
 * executable installer using Microsoft SignTool.exe (Sign Tool)
 * https://learn.microsoft.com/en-us/dotnet/framework/tools/signtool-exe
 */
async function signWindowsInstaller() {
	if (process.env.SM_CODE_SIGNING_CERT_SHA1_HASH) {
		const exeName = renamedOclifInstallers[process.platform];
		console.log(`Signing installer "${exeName}"`);
		// trust ...
		await execFileAsync('signtool.exe', [
			'sign',
			'-sha1',
			process.env.SM_CODE_SIGNING_CERT_SHA1_HASH,
			'-tr',
			process.env.TIMESTAMP_SERVER || 'http://timestamp.comodoca.com',
			'-td',
			'SHA256',
			'-fd',
			'SHA256',
			'-d',
			`balena-cli ${version}`,
			exeName,
		]);
		// ... but verify
		await execFileAsync('signtool.exe', ['verify', '-pa', '-v', exeName]);
	} else {
		console.log(
			'Skipping installer signing step because CSC_* env vars are not set',
		);
	}
}

/**
 * Wait for Apple Installer Notarization to continue
 */
async function notarizeMacInstaller(): Promise<void> {
	const teamId = process.env.XCODE_APP_LOADER_TEAM_ID || '66H43P8FRG';
	const appleId =
		process.env.XCODE_APP_LOADER_EMAIL || 'accounts+apple@balena.io';
	const appleIdPassword = process.env.XCODE_APP_LOADER_PASSWORD;

	if (appleIdPassword && teamId) {
		await notarize({
			tool: 'notarytool',
			teamId,
			appPath: renamedOclifInstallers.darwin,
			appleId,
			appleIdPassword,
		});
	}
}

/**
 * Run the `oclif pack:win` or `pack:macos` command (depending on the value
 * of process.platform) to generate the native installers (which end up under
 * the 'dist' folder). There are some harcoded options such as selecting only
 * 64-bit binaries under Windows.
 */
export async function buildOclifInstaller() {
	let packOS = '';
	let packOpts = ['-r', ROOT];
	if (process.platform === 'darwin') {
		packOS = 'macos';
		packOpts = packOpts.concat('--targets', `darwin-${arch}`);
	} else if (process.platform === 'win32') {
		packOS = 'win';
		packOpts = packOpts.concat('--targets', 'win32-x64');
	}
	if (packOS) {
		console.log(`Building oclif installer for CLI ${version}`);
		const packCmd = `pack:${packOS}`;
		const dirs = [path.join(ROOT, 'dist', packOS)];
		if (packOS === 'win') {
			dirs.push(path.join(ROOT, 'tmp', 'win*'));
		}
		for (const dir of dirs) {
			console.log(`rimraf(${dir})`);
			await Bluebird.fromCallback((cb) => rimraf(dir, cb));
		}
		console.log('=======================================================');
		console.log(`oclif ${packCmd} ${packOpts.join(' ')}`);
		console.log(`cwd="${process.cwd()}" ROOT="${ROOT}"`);
		console.log('=======================================================');
		const oclifPath = path.join(ROOT, 'node_modules', 'oclif');
		await oclifRun([packCmd].concat(...packOpts), oclifPath);
		await renameInstallerFiles();
		// The Windows installer is explicitly signed here (oclif doesn't do it).
		// The macOS installer is automatically signed by oclif (which runs the
		// `pkgbuild` tool), using the certificate name given in package.json
		// (`oclif.macos.sign` section).
		if (process.platform === 'win32') {
			await signWindowsInstaller();
		} else if (process.platform === 'darwin') {
			console.log('Notarizing package...');
			await notarizeMacInstaller(); // Notarize
			console.log('Package notarized.');
		}
		console.log(`oclif installer build completed`);
	}
}

/**
 * Wrapper around the npm `catch-uncommitted` package in order to run it
 * conditionally, only when:
 * - A CI env var is set (CI=true), and
 * - The OS is not Windows. (`catch-uncommitted` fails on Windows)
 */
export async function catchUncommitted(): Promise<void> {
	if (process.env.DEBUG) {
		console.error(`[debug] CI=${process.env.CI} platform=${process.platform}`);
	}
	if (
		process.env.CI &&
		['true', 'yes', '1'].includes(process.env.CI.toLowerCase()) &&
		process.platform !== 'win32'
	) {
		await whichSpawn('npx', [
			'catch-uncommitted',
			'--catch-no-git',
			'--skip-node-versionbot-changes',
			'--ignore-space-at-eol',
		]);
	}
}

export async function testShrinkwrap(): Promise<void> {
	if (process.env.DEBUG) {
		console.error(`[debug] platform=${process.platform}`);
	}
	if (process.platform !== 'win32') {
		await whichSpawn(
			path.resolve(import.meta.dirname, 'test-lock-deduplicated.sh'),
		);
	}
}
