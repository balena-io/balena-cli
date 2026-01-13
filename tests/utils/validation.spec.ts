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

import chaiAsPromised from 'chai-as-promised';
import * as chai from 'chai';
import { ExpectedError } from '../../build/src/errors.js';
import * as v from '../../build/src/utils/validation.js';

chai.use(chaiAsPromised);
const { expect } = chai;

describe('validateEmail() function', () => {
	it('should reject invalid email addresses with a message', () => {
		const errorMessage = 'Email is not valid';
		expect(v.validateEmail('test.com')).to.equal(errorMessage);
		expect(v.validateEmail('@test.com')).to.equal(errorMessage);
		expect(v.validateEmail('test@')).to.equal(errorMessage);
		expect(v.validateEmail('test@@test.com')).to.equal(errorMessage);
		expect(v.validateEmail('1234')).to.equal(errorMessage);
		expect(v.validateEmail('')).to.equal(errorMessage);

		// Note, currently does not validate domains well, and allows these invalid patterns:
		//  - test@test
		//  - test@test..com
	});

	it('should return true for valid emails', () => {
		expect(v.validateEmail('test@test.com')).to.equal(true);
		expect(v.validateEmail('t.e.s.t@test.com')).to.equal(true);
		expect(v.validateEmail('test+test@test.com')).to.equal(true);
		expect(v.validateEmail('test@test.io')).to.equal(true);
	});
});

describe('validatePassword() function', () => {
	it('should reject passwords shorter than 8 characters, with a message', () => {
		const errorMessage = 'Password should be 8 characters long';
		expect(v.validatePassword('abc')).to.equal(errorMessage);
		expect(v.validatePassword('')).to.equal(errorMessage);
	});

	it('should return true for passwords of 8 characters or more', () => {
		expect(v.validatePassword('abcdefgh')).to.equal(true);
		expect(v.validatePassword('abcdefghi')).to.equal(true);
	});
});

describe('validateApplicationName() function', () => {
	it('should reject fleet names shorter than 4 characters, with a message', () => {
		const errorMessage = 'The fleet name should be at least 4 characters long';
		expect(v.validateApplicationName('abc')).to.equal(errorMessage);
		expect(v.validateApplicationName('')).to.equal(errorMessage);
	});

	it('should return false for fleet names with characters other than `a-z,A-Z,0-9,_-`', () => {
		expect(v.validateApplicationName('abcd.')).to.equal(false);
		expect(v.validateApplicationName('abcd$')).to.equal(false);
		expect(v.validateApplicationName('ab cd')).to.equal(false);
		expect(v.validateApplicationName('(abcd)')).to.equal(false);
	});

	it('should return true for valid fleet names', () => {
		expect(v.validateApplicationName('Test-Application1')).to.equal(true);
		expect(v.validateApplicationName('test_application2')).to.equal(true);
	});
});

describe('validateIPAddress() function', () => {
	it('should return false for invalid IP addresses', () => {
		expect(v.validateIPAddress('')).to.equal(false);
		expect(v.validateIPAddress('abc')).to.equal(false);
		expect(v.validateIPAddress('127')).to.equal(false);
		expect(v.validateIPAddress('127.0')).to.equal(false);
		expect(v.validateIPAddress('127.0.0')).to.equal(false);
		expect(v.validateIPAddress('127..0.0.1')).to.equal(false);

		// Note,
		//  - incorrectly allows leading zeros, e.g. 127.0.000.001
		//  - Allows IP and port, e.g. 127.0.0.1:80
	});

	it('should return true for valid IP addresses', () => {
		expect(v.validateIPAddress('127.0.0.1')).to.equal(true);
		expect(v.validateIPAddress('192.168.0.1')).to.equal(true);
		expect(v.validateIPAddress('1.1.1.1')).to.equal(true);

		// Note, does not support IPv6 addresses.
	});
});

describe('validateDotLocalUrl() function', () => {
	it('should return false for invalid dot local URLs', () => {
		expect(v.validateDotLocalUrl('')).to.equal(false);
		expect(v.validateDotLocalUrl('abc')).to.equal(false);
		expect(v.validateDotLocalUrl('abc123local')).to.equal(false);
		expect(v.validateDotLocalUrl('abc123.loca')).to.equal(false);
	});

	it('should return true for valid dot local URLs', () => {
		expect(v.validateDotLocalUrl('820b04a.local')).to.equal(true);
		expect(v.validateDotLocalUrl('aaaaaaa.local')).to.equal(true);
		expect(v.validateDotLocalUrl('1234567.local')).to.equal(true);
	});
});

describe('validateLongUuid() function', () => {
	it('should return false for strings with length other than 32 or 62', () => {
		expect(v.validateLongUuid('')).to.equal(false);
		expect(v.validateLongUuid('abc')).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(31))).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(33))).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(64))).to.equal(false);
	});

	it('should return false for strings with characters other than a-f,0-9', () => {
		expect(v.validateLongUuid('a'.repeat(31) + 'A')).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(31) + 'g')).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(31) + '.')).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(31) + '-')).to.equal(false);
		expect(v.validateLongUuid('a'.repeat(31) + '_')).to.equal(false);
	});

	it('should return true for valid long UUIDs', () => {
		expect(v.validateLongUuid('8ab84942d20b4753e08243a9e3a177e2')).to.equal(
			true,
		);
		expect(v.validateLongUuid('a'.repeat(62))).to.equal(true);
	});
});

describe('validateShortUuid() function', () => {
	it('should return false for strings with length other than 7', () => {
		expect(v.validateShortUuid('')).to.equal(false);
		expect(v.validateShortUuid('abc')).to.equal(false);
		expect(v.validateShortUuid('a'.repeat(6))).to.equal(false);
		expect(v.validateShortUuid('a'.repeat(8))).to.equal(false);
	});

	it('should return false for strings with characters other than a-z,0-9', () => {
		expect(v.validateShortUuid('a'.repeat(31) + 'A')).to.equal(false);
		expect(v.validateShortUuid('a'.repeat(31) + '.')).to.equal(false);
		expect(v.validateShortUuid('a'.repeat(31) + '-')).to.equal(false);
		expect(v.validateShortUuid('a'.repeat(31) + '_')).to.equal(false);
	});

	it('should return true for valid short UUIDs', () => {
		expect(v.validateShortUuid('8ab8494')).to.equal(true);
	});
});

describe('validateUuid() function', () => {
	it('should return false for strings with length other than 7, 32 or 62', () => {
		expect(v.validateUuid('')).to.equal(false);
		expect(v.validateUuid('abc')).to.equal(false);
		expect(v.validateUuid('a'.repeat(6))).to.equal(false);
		expect(v.validateUuid('a'.repeat(8))).to.equal(false);
		expect(v.validateUuid('a'.repeat(31))).to.equal(false);
		expect(v.validateUuid('a'.repeat(33))).to.equal(false);
		expect(v.validateUuid('a'.repeat(64))).to.equal(false);
	});

	it('should return false for strings with characters other than a-f,0-9', () => {
		expect(v.validateUuid('a'.repeat(31) + 'A')).to.equal(false);
		expect(v.validateUuid('a'.repeat(31) + 'g')).to.equal(false);
		expect(v.validateUuid('a'.repeat(31) + '.')).to.equal(false);
		expect(v.validateUuid('a'.repeat(31) + '-')).to.equal(false);
		expect(v.validateUuid('a'.repeat(31) + '_')).to.equal(false);
	});

	it('should return true for valid UUIDs', () => {
		expect(v.validateUuid('8ab8494')).to.equal(true);
		expect(v.validateUuid('8ab84942d20b4753e08243a9e3a177e2')).to.equal(true);
		expect(v.validateLongUuid('a'.repeat(62))).to.equal(true);
	});
});

describe('parseAsInteger() function', () => {
	it('should reject non-numeric characters', () => {
		expect(v.parseAsInteger('abc')).to.be.rejectedWith(ExpectedError);
		expect(v.parseAsInteger('1a')).to.be.rejectedWith(ExpectedError);
		expect(v.parseAsInteger('a1')).to.be.rejectedWith(ExpectedError);
		expect(v.parseAsInteger('a')).to.be.rejectedWith(ExpectedError);
		expect(v.parseAsInteger('1.0')).to.be.rejectedWith(ExpectedError);
	});

	it('should reject leading zeros', () => {
		expect(v.parseAsInteger('01')).to.be.rejectedWith(ExpectedError);
		expect(v.parseAsInteger('001')).to.be.rejectedWith(ExpectedError);
	});

	it('should throw with specific message when param name passed', () => {
		expect(v.parseAsInteger('abc')).to.be.rejectedWith(
			'The parameter must be an integer.',
		);
	});

	it('should throw with general message when no param name passed', () => {
		expect(v.parseAsInteger('abc', 'foo')).to.be.rejectedWith(
			"The parameter 'foo' must be an integer.",
		);
	});

	it('should parse integers to number type', async () => {
		expect(await v.parseAsInteger('100')).to.equal(100);
		expect(await v.parseAsInteger('100')).to.be.a('number');
		expect(await v.parseAsInteger('0')).to.equal(0);
		expect(await v.parseAsInteger('0')).to.be.a('number');
	});
});

describe('tryAsInteger() function', () => {
	it('should return string with non-numeric characters as string', async () => {
		expect(await v.tryAsInteger('abc')).to.be.a('string');
		expect(await v.tryAsInteger('1a')).to.be.a('string');
		expect(await v.tryAsInteger('a1')).to.be.a('string');
		expect(await v.tryAsInteger('a')).to.be.a('string');
		expect(await v.tryAsInteger('1.0')).to.be.a('string');
	});

	it('should return numerical strings with leading zeros as string', async () => {
		expect(await v.tryAsInteger('01')).to.be.a('string');
		expect(await v.tryAsInteger('001')).to.be.a('string');
	});

	it('should return numerical strings without leading zeros as number', async () => {
		expect(await v.tryAsInteger('100')).to.be.a('number');
		expect(await v.tryAsInteger('256')).to.be.a('number');
		expect(await v.tryAsInteger('0')).to.be.a('number');
	});
});
