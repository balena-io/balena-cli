/**
 * @license
 * Copyright 2020 Balena Ltd.
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

const { stripIndent } = require('common-tags');
const _ = require('lodash');
const { fs } = require('mz');
const path = require('path');
const simplegit = require('simple-git/promise');

const ROOT = path.normalize(path.join(__dirname, '..'));

/**
 * Compare the timestamp of cli.markdown with the timestamp of staged files,
 * issuing an error if cli.markdown is older. Besides the purpose of ensuring
 * that cli.markdown is updated, it effectively also ensures that coffeelint
 * is executed (via `npm run build` or `npm test`) on the developers laptop,
 * so that there is at least a chance that the developer will spot any linter
 * warnings (that could reveal bugs) sooner than later.  (The CI does not
 * currently fail in case of coffeelint warnings.)
 * If cli.markdown does not require updating and the developer cannot run
 * `npm run build` on their laptop, the error message suggests a workaround
 * using `touch`.
 */
async function checkBuildTimestamps() {
	const git = simplegit(ROOT);
	const docFile = path.join(ROOT, 'doc', 'cli.markdown');
	const [docStat, gitStatus] = await Promise.all([
		fs.stat(docFile),
		git.status(),
	]);
	const stagedFiles = _.uniq([
		...gitStatus.created,
		...gitStatus.staged,
		...gitStatus.renamed.map(o => o.to),
	])
		// select only staged files that start with lib/ or typings/
		.filter(f => f.match(/^(lib|typings)[/\\]/))
		.map(f => path.join(ROOT, f));

	const fStats = await Promise.all(stagedFiles.map(f => fs.stat(f)));
	fStats.forEach((fStat, index) => {
		if (fStat.mtimeMs > docStat.mtimeMs) {
			const fPath = stagedFiles[index];
			throw new Error(stripIndent`
				--------------------------------------------------------------------------------
				ERROR: at least one staged file: "${fPath}"
				has a more recent modification timestamp than the documentation file:
				"${docFile}"

				This probably means that \`npm run build\` or \`npm test\` have not been executed,
				and this error can be fixed by doing so. Running \`npm run build\` or \`npm test\`
				before commiting is currently a requirement (documented in the CONTRIBUTING.md
				file) for three reasons:
				1. To update the CLI markdown documentation (in case any command-line options
				   were updated, added or removed).
				2. To catch Typescript type check errors sooner and reduce overall waiting time,
				   given that balena-cli CI builds/tests are currently rather lengthy.

				If you need/wish to bypass this check without running \`npm run build\`, run:
				  npx touch -am "${docFile}"
				and then try again.
				--------------------------------------------------------------------------------
			`);
		}
	});
}

async function run() {
	try {
		await checkBuildTimestamps();
	} catch (err) {
		console.error(err.message);
		process.exitCode = 1;
	}
}

run();
