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

import { BalenaReleaseNotFound } from 'balena-errors';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { ExpectedError } from '../../build/errors';
import { disambiguateReleaseParam } from '../../build/utils/normalization';

describe('disambiguateReleaseParam() function', () => {
	it('should reject empty values', async () => {
		try {
			await disambiguateReleaseParam(null as any, '');
			throw new Error('should not be reached');
		} catch (e) {
			expect(e).to.be.an.instanceOf(ExpectedError);
			expect(e.message).to.equal('Invalid release parameter');
		}
	});

	it('should reject values containing invalid chars', async () => {
		const invalidCharExamples = ' .,-_=!@#$%^&*() ';

		for (const char of invalidCharExamples) {
			try {
				await disambiguateReleaseParam(null as any, char);
				throw new Error('should not be reached');
			} catch (e) {
				expect(e).to.be.an.instanceOf(ExpectedError);
				expect(e.message).to.equal('Invalid release parameter');
			}
		}
	});

	it('should reject non-numerical values with invalid uuid/hash lengths', async () => {
		const invalidLengthValue = 'abcd';

		try {
			await disambiguateReleaseParam(null as any, invalidLengthValue);
			throw new Error('should not be reached');
		} catch (e) {
			expect(e).to.be.an.instanceOf(ExpectedError);
			expect(e.message).to.equal('Invalid release parameter');
		}
	});

	it('should reject leading-zero numerical values with invalid uuid/hash lengths', async () => {
		const invalidLengthValue = '01234';

		try {
			await disambiguateReleaseParam(null as any, invalidLengthValue);
			throw new Error('should not be reached');
		} catch (e) {
			expect(e).to.be.an.instanceOf(ExpectedError);
			expect(e.message).to.equal('Invalid release parameter');
		}
	});

	it('should return non-numerical values with valid hash lengths as string, without SDK calls', async () => {
		const uuid7 = 'a'.repeat(7);
		const uuid32 = 'a'.repeat(32);
		const uuid62 = 'a'.repeat(62);
		const hash8 = 'a'.repeat(8);
		const hash9 = 'a'.repeat(9);
		const hash40 = 'a'.repeat(40);

		expect(await disambiguateReleaseParam(null as any, uuid7)).to.equal(uuid7);
		expect(await disambiguateReleaseParam(null as any, uuid32)).to.equal(
			uuid32,
		);
		expect(await disambiguateReleaseParam(null as any, uuid62)).to.equal(
			uuid62,
		);
		expect(await disambiguateReleaseParam(null as any, hash8)).to.equal(hash8);
		expect(await disambiguateReleaseParam(null as any, hash9)).to.equal(hash9);
		expect(await disambiguateReleaseParam(null as any, hash40)).to.equal(
			hash40,
		);
	});

	it('should return numerical, leading zero values with valid uuid/hash lengths as string, without SDK calls', async () => {
		const uuid7 = '0' + '1'.repeat(6);
		const uuid32 = '0' + '1'.repeat(31);
		const uuid62 = '0' + '1'.repeat(61);
		const hash8 = '0' + '1'.repeat(7);
		const hash9 = '0' + '1'.repeat(8);
		const hash40 = '0' + '1'.repeat(39);

		expect(await disambiguateReleaseParam(null as any, uuid7)).to.equal(uuid7);
		expect(await disambiguateReleaseParam(null as any, uuid32)).to.equal(
			uuid32,
		);
		expect(await disambiguateReleaseParam(null as any, uuid62)).to.equal(
			uuid62,
		);
		expect(await disambiguateReleaseParam(null as any, hash8)).to.equal(hash8);
		expect(await disambiguateReleaseParam(null as any, hash9)).to.equal(hash9);
		expect(await disambiguateReleaseParam(null as any, hash40)).to.equal(
			hash40,
		);
	});

	it('should return id from SDK on first call, if match is found', async () => {
		const input = '1234';
		const output = 1234;
		const getRelease = sinon.stub().resolves({ id: output });
		const sdk: any = {
			models: {
				release: {
					get: getRelease,
				},
			},
		};

		const result = await disambiguateReleaseParam(sdk, input);

		expect(result).to.equal(output);
		expect(getRelease.calledOnce).to.be.true;
		expect(getRelease.getCall(0).args[0]).to.equal(parseInt(input, 10));
	});

	it('should return id from SDK on second call, if match is found', async () => {
		const input = '1234';
		const output = 1234;
		const getRelease = sinon.stub().rejects(new BalenaReleaseNotFound(input));
		const pineGet = sinon.stub().resolves([{ id: output }]);

		const sdk: any = {
			pine: {
				get: pineGet,
			},
			models: {
				release: {
					get: getRelease,
				},
			},
			utils: {
				mergePineOptions: (param1: any, param2: any) => {
					return {
						...param1,
						...param2,
					};
				},
			},
		};

		const result = await disambiguateReleaseParam(sdk, input);

		expect(result).to.equal(output);
		expect(getRelease.calledOnce).to.be.true;
		expect(getRelease.getCall(0).args[0]).to.equal(parseInt(input, 10));
		expect(pineGet.calledOnce).to.be.true;
		expect(pineGet.getCall(0).args[0]).to.deep.equal({
			resource: 'release',
			options: {
				$select: 'id',
				$filter: {
					commit: { $startswith: input },
				},
			},
		});
	});

	it('should throw error if no match found', async () => {
		const input = '1234';
		const getRelease = sinon.stub().rejects(new BalenaReleaseNotFound(input));
		const pineGet = sinon.stub().resolves([]);

		const sdk: any = {
			pine: {
				get: pineGet,
			},
			models: {
				release: {
					get: getRelease,
				},
			},
			utils: {
				mergePineOptions: (param1: any, param2: any) => {
					return {
						...param1,
						...param2,
					};
				},
			},
			errors: {
				BalenaReleaseNotFound,
			},
		};

		try {
			await disambiguateReleaseParam(sdk, input);
			throw new Error('should not be reached');
		} catch (e) {
			expect(e).to.be.an.instanceOf(BalenaReleaseNotFound);
			expect(getRelease.calledOnce).to.be.true;
			expect(getRelease.getCall(0).args[0]).to.equal(parseInt(input, 10));
			expect(pineGet.calledOnce).to.be.true;
			expect(pineGet.getCall(0).args[0]).to.deep.equal({
				resource: 'release',
				options: {
					$select: 'id',
					$filter: {
						commit: { $startswith: input },
					},
				},
			});
		}
	});

	it('should throw error if unknown error returned from SDK', async () => {
		const input = '1234';

		const getRelease = sinon.stub().rejects(new Error('some error'));

		const sdk: any = {
			models: {
				release: {
					get: getRelease,
				},
			},
		};

		try {
			await disambiguateReleaseParam(sdk, input);
			throw new Error('should not be reached');
		} catch (e) {
			expect(e).to.be.an.instanceOf(Error);
			expect(e.message).to.equal('some error');
			expect(getRelease.calledOnce).to.be.true;
		}
	});
});
