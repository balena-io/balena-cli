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

import { convertEolInPlace } from '../../build/utils/eol-conversion';

describe('convertEolInPlace() function', function() {
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
