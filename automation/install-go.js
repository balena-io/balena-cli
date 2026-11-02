#!/usr/bin/env node
'use strict';

/**
 * Make the Go toolchain available for building @balena/compose-parser.
 *
 * Runs as the `flowzone-preinstall` npm hook, before any dependencies are
 * installed, so it only uses Node built-ins. If `go` is already on PATH this
 * does nothing. Otherwise it downloads the pinned release from go.dev, checks
 * its SHA-256 against the checksum listed by go.dev, extracts it, and appends
 * its bin directory to $GITHUB_PATH so that later steps of the job can run it.
 */

const { spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const os = require('os');
const path = require('path');

const GO_VERSION = 'go1.24.13';
const INDEX_URL = 'https://go.dev/dl/?mode=json&include=all';

function goPlatform() {
	const oses = { linux: 'linux', darwin: 'darwin', win32: 'windows' };
	const arches = { x64: 'amd64', arm64: 'arm64' };
	const goOs = oses[process.platform];
	const arch = arches[process.arch];
	if (goOs == null || arch == null) {
		throw new Error(
			`Unsupported platform: ${process.platform}/${process.arch}`,
		);
	}
	return { os: goOs, arch };
}

/**
 * GET a URL, following redirects, and resolve with the response stream.
 */
function get(url) {
	return new Promise((resolve, reject) => {
		https
			.get(url, (res) => {
				if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
					res.resume();
					get(new URL(res.headers.location, url)).then(resolve, reject);
					return;
				}
				if (res.statusCode !== 200) {
					res.resume();
					reject(new Error(`GET ${url} failed: HTTP ${res.statusCode}`));
					return;
				}
				resolve(res);
			})
			.on('error', reject);
	});
}

async function getJson(url) {
	const res = await get(url);
	let body = '';
	for await (const chunk of res) {
		body += chunk;
	}
	return JSON.parse(body);
}

function sha256File(file) {
	return new Promise((resolve, reject) => {
		const hash = crypto.createHash('sha256');
		fs.createReadStream(file)
			.on('error', reject)
			.on('data', (chunk) => {
				hash.update(chunk);
			})
			.on('end', () => {
				resolve(hash.digest('hex'));
			});
	});
}

async function download(url, file) {
	const res = await get(url);
	await new Promise((resolve, reject) => {
		res
			.pipe(fs.createWriteStream(file))
			.on('error', reject)
			.on('finish', resolve);
	});
}

function goVersionOk(goBin) {
	const result = spawnSync(goBin, ['version'], { encoding: 'utf8' });
	return result.status === 0 ? result.stdout.trim() : null;
}

async function installGo() {
	const { os: goOs, arch } = goPlatform();
	const installDir = path.join(
		os.homedir(),
		'.cache',
		'balena-cli-go',
		GO_VERSION,
	);
	const binDir = path.join(installDir, 'go', 'bin');
	const goBin = path.join(
		binDir,
		process.platform === 'win32' ? 'go.exe' : 'go',
	);

	if (goVersionOk(goBin) == null) {
		console.log(`Installing ${GO_VERSION} for ${goOs}/${arch}`);
		const index = await getJson(INDEX_URL);
		const release = index.find((r) => r.version === GO_VERSION);
		const file = release?.files.find(
			(f) => f.kind === 'archive' && f.os === goOs && f.arch === arch,
		);
		if (file == null) {
			throw new Error(`${GO_VERSION} has no archive for ${goOs}/${arch}`);
		}

		fs.mkdirSync(installDir, { recursive: true });
		const archive = path.join(installDir, file.filename);
		await download(`https://go.dev/dl/${file.filename}`, archive);
		const digest = await sha256File(archive);
		if (digest !== file.sha256) {
			fs.rmSync(archive, { force: true });
			throw new Error(
				`SHA-256 mismatch for ${file.filename}: expected ${file.sha256}, got ${digest}`,
			);
		}

		// Both .tar.gz and .zip archives extract with tar: bsdtar on macOS and
		// Windows, GNU tar on Linux.
		const extract = spawnSync('tar', ['-xf', archive, '-C', installDir], {
			stdio: 'inherit',
		});
		fs.rmSync(archive, { force: true });
		if (extract.status !== 0) {
			throw new Error(`tar failed to extract ${file.filename}`);
		}
	}

	const version = goVersionOk(goBin);
	if (version == null) {
		throw new Error(`${goBin} does not run after extraction`);
	}
	console.log(`Using ${version} at ${goBin}`);

	if (process.env.GITHUB_PATH) {
		fs.appendFileSync(process.env.GITHUB_PATH, `${binDir}\n`);
	} else {
		console.log(`Add ${binDir} to PATH to use this Go`);
	}
}

if (goVersionOk('go') != null) {
	console.log(`Go already installed: ${goVersionOk('go')}`);
} else {
	installGo().catch((err) => {
		console.error(err.message);
		process.exit(1);
	});
}
