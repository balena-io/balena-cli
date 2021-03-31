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

import { expect } from 'chai';
import { promises as fs } from 'fs';
import * as path from 'path';

import {
	convertEolInPlace,
	detectEncoding,
} from '../../build/utils/eol-conversion';

describe('convertEolInPlace() function', function () {
	it('should return expected values', () => {
		// pairs of [given input, expected output]
		const testVector = [
			['', ''],
			['\r', '\r'],
			['\n', '\n'],
			['\r\r', '\r\r'],
			['\n\r', '\n\r'],
			['\r\n', '\n'],
			['\r\n\n', '\n\n'],
			['\r\n\r', '\n\r'],
			['\r\n\r\n', '\n\n'],
			['\r\n\n\r', '\n\n\r'],
			['abc\r\ndef\r\n', 'abc\ndef\n'],
			['abc\r\ndef\n\r', 'abc\ndef\n\r'],
			['abc\r\ndef\n', 'abc\ndef\n'],
			['abc\r\ndef\r', 'abc\ndef\r'],
			['abc\r\ndef', 'abc\ndef'],
			['\r\ndef\r\n', '\ndef\n'],
			['\rdef\r', '\rdef\r'],
		];
		const js = JSON.stringify;

		for (const [input, expected] of testVector) {
			const result = convertEolInPlace(Buffer.from(input));
			const resultStr = result.toString();
			const msg = `input=${js(input)} result=${js(resultStr)} expected=${js(
				expected,
			)}`;
			expect(resultStr).to.equal(expected, msg);
		}
	});
});

describe('detectEncoding() function', function () {
	it('should correctly detect the encoding of a few selected files', async () => {
		const sampleBinary = [
			'drivelist/build/Release/drivelist.node',
			'@balena.io/usb/build/Release/usb_bindings.node',
			'xxhash/build/Release/hash.node',
			'mountutils/build/Release/MountUtils.node',
		];
		const sampleText = [
			'node_modules/.bin/etcher-image-write',
			'node_modules/.bin/mocha',
			'node_modules/.bin/rimraf',
			'node_modules/.bin/gulp',
			'node_modules/.bin/coffeelint',
			'node_modules/.bin/tsc',
			'node_modules/.bin/balena-lint',
			'node_modules/.bin/balena-preload',
			'node_modules/.bin/catch-uncommitted',
		];

		for (const fname of sampleBinary) {
			const buf = await fs.readFile(path.join('node_modules', fname));
			const encoding = await detectEncoding(buf);
			expect(encoding).to.equal('binary');
		}
		for (const fname of sampleText) {
			const buf = await fs.readFile(fname);
			const encoding = await detectEncoding(buf);
			expect(encoding).to.equal('utf-8');
		}
	});
});
