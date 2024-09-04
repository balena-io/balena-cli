/**
 * @license
 * Copyright 2021 Balena Ltd.
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

import ConfigWriteCmd from '../../../build/commands/config/write.js';

// "itSS" means "it() Skip Standalone"
const itSS = process.env.BALENA_CLI_TEST_TYPE === 'standalone' ? it.skip : it;

describe('balena config write', function () {
	itSS('updateConfigJson should match expected output', () => {
		const testVector: Array<[object, string, any, object]> = [
			[{}, 'a.b', 'c', { a: { b: 'c' } }],
			[{}, 'a.1', true, { a: { '1': true } }],
			[{}, 'a.true', 1, { a: { true: 1 } }],
			[{}, 'a.1', 1.1, { a: { '1': 1.1 } }],
			[{ a: 'b' }, 'a', 2, { a: 2 }],
			[{ a: ['b'] }, 'a', 2, { a: 2 }],
			[{ a: ['b'] }, 'a.1', 'c', { a: ['b', 'c'] }],
			// eslint-disable-next-line no-sparse-arrays
			[{ a: ['b'] }, 'a.2', 'c', { a: ['b', , 'c'] }],
			[{ a: { '1': 'b' } }, 'a.1', 'c', { a: { '1': 'c' } }],
			[{ a: { '1': 'b' } }, 'a.2', 'c', { a: { '1': 'b', '2': 'c' } }],
			// fix: https://forums.balena.io/t/programatically-github-actions-add-udev-rule-to-config-file/337399
			[
				{ a: 'b' },
				'os.udevRules.101',
				'ACTION=="add", SUBSYSTEMS=="usb", RUN+="/usr/sbin/nvpmodel -m 0"',
				{
					a: 'b',
					os: {
						udevRules: {
							'101':
								'ACTION=="add", SUBSYSTEMS=="usb", RUN+="/usr/sbin/nvpmodel -m 0"',
						},
					},
				},
			],
			[
				{ os: { udevRules: { '101': 'foo' } } },
				'os.udevRules.101',
				'bar',
				{ os: { udevRules: { '101': 'bar' } } },
			],
			[
				{ os: { udevRules: { '101': 'foo' } } },
				'os.udevRules.102',
				'bar',
				{ os: { udevRules: { '101': 'foo', '102': 'bar' } } },
			],
		];
		for (const [configJson, key, value, expected] of testVector) {
			ConfigWriteCmd.updateConfigJson(configJson, key, value);
			expect(configJson).to.deep.equal(expected);
		}
	});
});
