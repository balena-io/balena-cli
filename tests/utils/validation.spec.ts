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
import { ExpectedError } from '../../build/errors';
import { parseAsInteger } from '../../build/utils/validation';

describe('parseAsInteger() function', function() {
	it('should reject non-numeric characters', () => {
		expect(() => parseAsInteger('abc')).to.throw(ExpectedError);
		expect(() => parseAsInteger('1a')).to.throw(ExpectedError);
		expect(() => parseAsInteger('a1')).to.throw(ExpectedError);
		expect(() => parseAsInteger('a')).to.throw(ExpectedError);
		expect(() => parseAsInteger('1.0')).to.throw(ExpectedError);
	});

	it('should reject leading zeros', () => {
		expect(() => parseAsInteger('01')).to.throw(ExpectedError);
		expect(() => parseAsInteger('001')).to.throw(ExpectedError);
	});

	it('should throw with specific message when param name passed', () => {
		expect(() => parseAsInteger('abc')).to.throw(
			'The parameter must be an integer.',
		);
	});

	it('should throw with general message when no param name passed', () => {
		expect(() => parseAsInteger('abc', 'foo')).to.throw(
			"The parameter 'foo' must be an integer.",
		);
	});

	it('should parse integers to number type', () => {
		expect(parseAsInteger('100')).to.equal(100);
		expect(parseAsInteger('100')).to.be.a('number');
		expect(parseAsInteger('0')).to.equal(0);
		expect(parseAsInteger('0')).to.be.a('number');
	});
});
