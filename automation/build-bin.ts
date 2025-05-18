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

import { run as oclifRun } from '@oclif/core';
import { exec, execFile } from 'child_process';
import type { Stats } from 'fs';
import * as fs from 'fs-extra';
import * as klaw from 'klaw';
import * as path from 'path';
import * as rimraf from 'rimraf';
import { promisify } from 'util';
import { notarize } from '@electron/notarize';

import { loadPackageJson, ROOT, whichSpawn } from './utils';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);
const rimrafAsync = promisify(rimraf);

export const packageJSON = loadPackageJson();
export const version = 'v' + packageJSON.version;
const arch = process.arch;

function dPath(...paths: string[]) {
	return path.join(ROOT, 'dist', ...paths);
}

interface PathByPlatform {
	[platform: string]: string;
}

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

const getOclifStandaloneOriginalNames = async (): Promise<PathByPlatform> => {
	const { stdout } = await execAsync('git rev-parse --short HEAD');
	const sha = stdout.trim();
	return {
		linux: dPath(`balena-${version}-${sha}-linux-${arch}.tar.gz`),
		darwin: dPath(`balena-${version}-${sha}-darwin-${arch}.tar.gz`),
		win32: dPath(`balena-${version}-${sha}-win32-${arch}.tar.gz`),
	};
};

const renamedOclifStandalone: PathByPlatform = {
	linux: dPath(`balena-cli-${version}-linux-${arch}-standalone.tar.gz`),
	darwin: dPath(`balena-cli-${version}-macOS-${arch}-standalone.tar.gz`),
	win32: dPath(`balena-cli-${version}-windows-${arch}-standalone.tar.gz`),
};

export async function signFilesForNotarization() {
	console.log('Signing files for notarization');
	// If signFilesForNotarization is called on the test CI environment (which will not set CSC_LINK)
	// then we skip the signing process.
	if (process.platform !== 'darwin' || !process.env.CSC_LINK) {
		console.log('Skipping signing for notarization');
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

export async function buildStandalone() {
	console.log(`Building standalone tarball for CLI ${version}`);
	fs.rmSync('./tmp', { recursive: true, force: true });
	fs.rmSync('./dist', { recursive: true, force: true });
	fs.mkdirSync('./dist');
	try {
		let packOpts = ['-r', ROOT, '--no-xz'];
		if (process.platform === 'darwin') {
			packOpts = packOpts.concat('--targets', `darwin-${arch}`);
		} else if (process.platform === 'win32') {
			packOpts = packOpts.concat('--targets', 'win32-x64');
		} else if (process.platform === 'linux') {
			packOpts = packOpts.concat('--targets', `linux-${arch}`);
		}

		console.log(`Building oclif installer for CLI ${version}`);
		const packCmd = `pack:tarballs`;
		console.log('=======================================================');
		console.log(`oclif ${packCmd} ${packOpts.join(' ')}`);
		console.log(`cwd="${process.cwd()}" ROOT="${ROOT}"`);
		console.log('=======================================================');
		const oclifPath = path.join(ROOT, 'node_modules', 'oclif');
		await oclifRun([packCmd].concat(...packOpts), oclifPath);
		await renameStandalone();

		console.log(`Standalone tarball package build completed`);
	} catch (error) {
		console.error(`Error creating or testing standalone tarball package`);
		throw error;
	}
}

async function renameInstallers() {
	const oclifInstallers = await getOclifInstallersOriginalNames();
	if (await fs.pathExists(oclifInstallers[process.platform])) {
		await fs.rename(
			oclifInstallers[process.platform],
			renamedOclifInstallers[process.platform],
		);
	}
}

async function renameStandalone() {
	const oclifStandalone = await getOclifStandaloneOriginalNames();
	if (await fs.pathExists(oclifStandalone[process.platform])) {
		await fs.rename(
			oclifStandalone[process.platform],
			renamedOclifStandalone[process.platform],
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
		const exeName = (await getOclifInstallersOriginalNames())[process.platform];
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
	const appPath = (await getOclifInstallersOriginalNames())[process.platform];
	console.log(`Notarizing file "${appPath}"`);

	if (appleIdPassword && teamId) {
		await notarize({
			tool: 'notarytool',
			teamId,
			appPath,
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
			await rimrafAsync(dir);
		}
		console.log('=======================================================');
		console.log(`oclif ${packCmd} ${packOpts.join(' ')}`);
		console.log(`cwd="${process.cwd()}" ROOT="${ROOT}"`);
		console.log('=======================================================');
		const oclifPath = path.join(ROOT, 'node_modules', 'oclif');
		await oclifRun([packCmd].concat(...packOpts), oclifPath);
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
		await renameInstallers();
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
		await whichSpawn(path.resolve(__dirname, 'test-lock-deduplicated.sh'));
	}
	await Promise.resolve();
}
