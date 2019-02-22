import * as Promise from 'bluebird';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';
import * as publishRelease from 'publish-release';

import * as packageJSON from '../package.json';

const publishReleaseAsync = Promise.promisify(publishRelease);

const { GITHUB_TOKEN } = process.env;
const ROOT = path.join(__dirname, '..');

const version = 'v' + packageJSON.version;
const outputFile = path.join(
	ROOT,
	'build-zip',
	`balena-cli-${version}-${os.platform()}-${os.arch()}.zip`,
);

publishReleaseAsync({
	token: <string>GITHUB_TOKEN,
	owner: 'balena-io',
	repo: 'balena-cli',
	tag: version,
	name: `balena-CLI ${version}`,
	reuseRelease: true,
	assets: [outputFile],
})
	.then(release => {
		console.log(`Release ${version} successful: ${release.html_url}`);
	})
	.catch(err => {
		console.error('Release failed');
		console.error(err);
		process.exit(1);
	});
