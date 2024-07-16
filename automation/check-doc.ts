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

// eslint-disable-next-line no-restricted-imports
import { stripIndent } from 'common-tags';
import _ from 'lodash';
import { promises as fs } from 'fs';
import * as path from 'path';
import { simpleGit } from 'simple-git';

const ROOT = path.normalize(path.join(import.meta.dirname, '..'));

/**
 * Compare the timestamp of balena-cli.md with the timestamp of staged files,
 * issuing an error if balena-cli.md is older.
 * If balena-cli.md does not require updating and the developer cannot run
 * `npm run build` on their laptop, the error message suggests a workaround
 * using `touch`.
 */
async function checkBuildTimestamps() {
	const git = simpleGit(ROOT);
	const docFile = path.join(ROOT, 'docs', 'balena-cli.md');
	const [docStat, gitStatus] = await Promise.all([
		fs.stat(docFile),
		git.status(),
	]);
	const stagedFiles = _.uniq([
		...gitStatus.created,
		...gitStatus.staged,
		...gitStatus.renamed.map((o) => o.to),
	])
		// select only staged files that start with lib/ or typings/
		.filter((f) => f.match(/^(lib|typings)[/\\]/))
		.map((f) => path.join(ROOT, f));

	const fStats = await Promise.all(stagedFiles.map((f) => fs.stat(f)));
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
				before commiting is required in order to update the CLI markdown documentation
				(in case any command-line options were updated, added or removed) and also to
				catch Typescript type check errors sooner and reduce overall waiting time, given
				that the CI build/tests are currently rather lengthy.

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

// eslint-disable-next-line @typescript-eslint/no-floating-promises
run();
