/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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
import { expect } from 'chai';
import * as fs from 'fs';
import * as os from 'os';

import { runCommand } from '../helpers';

const { version: packageJSONVersion } = JSON.parse(
	fs.readFileSync('./package.json', 'utf8'),
);

describe('balena version', function () {
	it('should print the installed version of the CLI', async () => {
		const { err, out } = await runCommand('version');
		expect(err).to.be.empty;
		expect(out[0]).to.include(`balena-cli/${packageJSONVersion}`);
	});

	// TODO: Come back to this when we migrate away from nock
	// nock cannot catch requests made to endpoints made by external processes
	it.skip('should print additional version information with the --verbose flag', async () => {
		const { err, out } = await runCommand('version --verbose');
		expect(err).to.be.empty;
		const splitOutput = out[0].split('\n');
		expect(splitOutput[1]).to.include(`balena-cli/${packageJSONVersion}`);
		expect(splitOutput[14].toLowerCase()).to.include(
			os.release().toLowerCase(),
		);

		if (process.env.BALENA_CLI_TEST_TYPE === 'standalone') {
			expect(splitOutput[7]).to.match(/node-v\d+\.\d+.\d+/);
		} else {
			expect(splitOutput[7]).to.include(`node-${process.version}`);
		}
	});

	it('should print version information as JSON with the the --json flag', async () => {
		const { err, out } = await runCommand('version --json');
		expect(err).to.be.empty;
		const json = JSON.parse(out.join(''));
		expect(json['cliVersion']).to.equal(`balena-cli/${packageJSONVersion}`);

		if (process.env.BALENA_CLI_TEST_TYPE === 'standalone') {
			expect(json['nodeVersion']).to.match(/node-v\d+\.\d+.\d+/);
		} else {
			expect(json['nodeVersion']).to.equal(`node-${process.version}`);
		}
	});
});
