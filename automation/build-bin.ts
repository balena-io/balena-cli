import * as Promise from 'bluebird';
import * as path from 'path';
import * as fs from 'fs-extra';
import * as filehound from 'filehound';
import * as archiver from 'archiver';
import { exec as execPkg } from 'pkg';
import * as os from 'os';
import * as packageJSON from '../package.json';
import * as mkdirp from 'mkdirp';

const version = 'v' + packageJSON.version;
const ROOT = path.join(__dirname, '..');
const outputFile = path.join(
	ROOT,
	'build-zip',
	`balena-cli-${version}-${os.platform()}-${os.arch()}.zip`,
);
const mkdirpAsync = Promise.promisify<string | null, string>(mkdirp);

console.log('Building package...\n');

execPkg(['--target', 'host', '--output', 'build-bin/balena', 'package.json'])
	.then(() =>
		fs.copy(
			path.join(ROOT, 'node_modules', 'opn', 'xdg-open'),
			path.join(ROOT, 'build-bin', 'xdg-open'),
		),
	)
	.then(() => {
		return filehound
			.create()
			.paths(path.join(ROOT, 'node_modules'))
			.ext(['node', 'dll'])
			.find();
	})
	.then(nativeExtensions => {
		console.log(`\nCopying to build-bin:\n${nativeExtensions.join('\n')}`);

		return nativeExtensions.map(extPath => {
			return fs.copy(
				extPath,
				extPath.replace(
					path.join(ROOT, 'node_modules'),
					path.join(ROOT, 'build-bin'),
				),
			);
		});
	})
	.then(() => {
		return mkdirpAsync(path.dirname(outputFile));
	})
	.then(() => {
		return new Promise((resolve, reject) => {
			console.log('Zipping build...');

			let archive = archiver('zip', {
				zlib: { level: 7 },
			});
			archive.directory(path.join(ROOT, 'build-bin'), 'balena-cli');

			let outputStream = fs.createWriteStream(outputFile);

			outputStream.on('close', resolve);
			outputStream.on('error', reject);

			archive.on('error', reject);
			archive.on('warning', console.warn);

			archive.pipe(outputStream);
			// archive.finalize();
		}).then(() => {
			console.log('Done')
		});
	});
