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

import { BalenaAPIMock } from '../nock/balena-api-mock';
import { runCommand } from '../helpers.js';

const packageJSON = JSON.parse(fs.readFileSync('./package.json', 'utf8'));
const nodeVersion = process.version.startsWith('v')
	? process.version.slice(1)
	: process.version;

describe('balena version', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should print the installed version of the CLI', async () => {
		const { err, out } = await runCommand('version');
		expect(err).to.be.empty;
		expect(out.join('')).to.equal(`${packageJSON.version}\n`);
	});

	it('should print additional version information with the -a flag', async () => {
		const { err, out } = await runCommand('version -a');
		expect(err).to.be.empty;
		expect(out[0].trim()).to.equal(
			`balena-cli version "${packageJSON.version}"`,
		);

		if (process.env.BALENA_CLI_TEST_TYPE === 'standalone') {
			expect(out[1]).to.match(/Node.js version "\d+\.\d+.\d+"/);
		} else {
			expect(out[1].trim()).to.equal(`Node.js version "${nodeVersion}"`);
		}
	});

	it('should print version information as JSON with the the -j flag', async () => {
		const { err, out } = await runCommand('version -j');
		expect(err).to.be.empty;
		const json = JSON.parse(out.join(''));
		expect(json['balena-cli']).to.equal(packageJSON.version);

		if (process.env.BALENA_CLI_TEST_TYPE === 'standalone') {
			expect(json['Node.js']).to.match(/\d+\.\d+.\d+/);
		} else {
			expect(json['Node.js']).to.equal(nodeVersion);
		}
	});
});
