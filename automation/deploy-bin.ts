import * as Promise from 'bluebird';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as publishRelease from 'publish-release';
import * as archiver from 'archiver';

const publishReleaseAsync = Promise.promisify(publishRelease);

const { GITHUB_TOKEN } = process.env;
const ROOT = path.join(__dirname, '..');

const version = 'v' + require('../package.json').version;
const outputFile = path.join(ROOT, `resin-cli-${version}-${os.platform()}-${os.arch()}.zip`);

new Promise((resolve, reject) => {
	console.log('Zipping build...');

	let archive = archiver('zip', {
		zlib: { level: 7 }
	});
	archive.directory(path.join(ROOT, 'build-bin'), 'resin-cli');

	let outputStream = fs.createWriteStream(outputFile);

	outputStream.on('close', resolve);
	outputStream.on('error', reject);

	archive.on('error', reject);
	archive.on('warning', console.warn);

	archive.pipe(outputStream);
	archive.finalize();
}).then(() => {
	console.log('Build zipped');
	console.log('Publishing build...');

	return publishReleaseAsync({
		token: GITHUB_TOKEN,
		owner: 'resin-io',
		repo: 'resin-cli',
		tag: version,
		name: `Resin-CLI ${version}`,
		reuseRelease: true,
		assets: [outputFile]
	});
}).then((release) => {
	console.log(`Release ${version} successful: ${release.html_url}`);
}).catch((err) => {
	console.error('Release failed');
	console.error(err);
	process.exit(1);
});
