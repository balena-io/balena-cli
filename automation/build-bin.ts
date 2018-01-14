import * as path from 'path';
import * as fs from 'fs-extra';
import * as filehound from 'filehound';
import { exec as execPkg } from 'pkg';

const ROOT = path.join(__dirname, '..');

console.log('Building package...\n');

execPkg(['--target', 'host', '--output', 'build-bin/resin', 'package.json'])
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
	});
