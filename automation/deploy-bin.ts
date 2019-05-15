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
import * as archiver from 'archiver';
import * as Bluebird from 'bluebird';
import * as fs from 'fs-extra';
import * as _ from 'lodash';
import * as mkdirp from 'mkdirp';
import * as path from 'path';
import * as publishRelease from 'publish-release';

const mkdirpAsync = Bluebird.promisify<string | null, string>(mkdirp);
const { GITHUB_TOKEN } = process.env;
const ROOT = path.join(__dirname, '..');
// Note: the following 'tslint disable' line was only required to
// satisfy ts-node under Appveyor's MSYS2 on Windows -- oddly specific.
// Maybe something to do with '/' vs '\' in paths in some tslint file.
// tslint:disable-next-line:no-var-requires
const packageJSON = require(path.join(ROOT, 'package.json'));
const version = 'v' + packageJSON.version;
const arch = process.arch;

function dPath(...paths: string[]) {
	return path.join(ROOT, 'dist', ...paths);
}

const standaloneZips: { [platform: string]: string } = {
	linux: dPath(`balena-cli-${version}-linux-${arch}-standalone.zip`),
	darwin: dPath(`balena-cli-${version}-macOS-${arch}-standalone.zip`),
	win32: dPath(`balena-cli-${version}-windows-${arch}-standalone.zip`),
};

const oclifInstallers: { [platform: string]: string } = {
	darwin: dPath('macos', `balena-${version}.pkg`),
	win32: dPath('win', `balena-${version}-${arch}.exe`),
};

const renamedOclifInstallers: { [platform: string]: string } = {
	darwin: dPath(`balena-cli-${version}-macOS-${arch}-installer-BETA.pkg`),
	win32: dPath(`balena-cli-${version}-windows-${arch}-installer-BETA.exe`),
};

const finalReleaseAssets: { [platform: string]: string[] } = {
	win32: [standaloneZips['win32'], renamedOclifInstallers['win32']],
	darwin: [standaloneZips['darwin'], renamedOclifInstallers['darwin']],
	linux: [standaloneZips['linux']],
};

/**
 * Create the zip file for the standalone 'pkg' bundle previously created
 * by the buildPkg() function in 'build-bin.ts'.
 */
export async function zipStandaloneInstaller() {
	const outputFile = standaloneZips[process.platform];
	if (!outputFile) {
		throw new Error(
			`Standalone installer unavailable for platform "${process.platform}"`,
		);
	}
	await mkdirpAsync(path.dirname(outputFile));
	await new Bluebird((resolve, reject) => {
		console.log(`Zipping build to "${outputFile}"...`);

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
		archive.finalize();
	});
	console.log('Build zipped');
}

/**
 * Create or update a release in GitHub's releases page, uploading the
 * installer files (standalone zip + native oclif installers).
 */
export async function createGitHubRelease() {
	console.log(`Publishing release ${version} to GitHub`);
	const ghRelease = await Bluebird.fromCallback(
		publishRelease.bind(null, {
			token: GITHUB_TOKEN || '',
			owner: 'balena-io',
			repo: 'balena-cli',
			tag: version,
			name: `balena-CLI ${version}`,
			reuseRelease: true,
			assets: finalReleaseAssets[process.platform],
		}),
	);
	console.log(`Release ${version} successful: ${ghRelease.html_url}`);
}

/**
 * Top-level function to create a CLI release in GitHub's releases page:
 * call zipStandaloneInstaller(), rename the files as we'd like them to
 * display on the releases page, and call createGitHubRelease() to upload
 * the files.
 */
export async function release() {
	console.log(`Creating release assets for CLI ${version}`);
	try {
		await zipStandaloneInstaller();
	} catch (error) {
		console.log(`Error creating standalone installer zip file: ${error}`);
		process.exit(1);
	}
	if (process.platform === 'win32' || process.platform === 'darwin') {
		if (fs.existsSync(oclifInstallers[process.platform])) {
			fs.renameSync(
				oclifInstallers[process.platform],
				renamedOclifInstallers[process.platform],
			);
		}
	}
	try {
		await createGitHubRelease();
	} catch (err) {
		console.error('Release failed');
		console.error(err);
		process.exit(1);
	}
}
