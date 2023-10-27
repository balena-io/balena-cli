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

import {
	BalenaAmbiguousApplication,
	BalenaApplicationNotFound,
	BalenaDeviceNotFound,
	BalenaExpiredToken,
} from 'balena-errors';
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as ErrorsModule from '../build/errors';
import { getHelp } from '../build/utils/messages';

function red(s: string) {
	if (process.env.CI) {
		// If CI, don't color.
		return s;
	}
	return `\u001b[31m${s}\u001b[39m`;
}

describe('handleError() function', () => {
	const sandbox = sinon.createSandbox();
	let printErrorMessage: any;
	let printExpectedErrorMessage: any;
	let captureException: any;
	let processExit: any;

	beforeEach(() => {
		printErrorMessage = sandbox.stub(ErrorsModule, 'printErrorMessage');
		printExpectedErrorMessage = sandbox.stub(
			ErrorsModule,
			'printExpectedErrorMessage',
		);
		captureException = sinon.stub();
		// @ts-expect-error TODO: get explanation for why this ts-expect-error is necessary
		sandbox.stub(ErrorsModule, 'getSentry').resolves({ captureException });
		processExit = sandbox.stub(process, 'exit');

		// Force debug mode off (currently set to true in CI env)
		sandbox.stub(process, 'env').value({ DEBUG: false });
	});
	afterEach(() => {
		sandbox.restore();
	});

	it('should process ExpectedErrors as expected', async () => {
		const errorMessage = 'an expected error';
		const error = new ErrorsModule.ExpectedError(errorMessage);

		await ErrorsModule.handleError(error);

		expect(printExpectedErrorMessage.calledOnce).to.be.true;
		expect(printExpectedErrorMessage.getCall(0).args[0]).to.equal(errorMessage);

		expect(printErrorMessage.notCalled).to.be.true;
		expect(captureException.notCalled).to.be.true;
		expect(processExit.notCalled).to.be.true;
	});

	it('should process subclasses of ExpectedErrors as expected', async () => {
		const errorMessage = 'an expected error';
		const error = new ErrorsModule.NotLoggedInError(errorMessage);

		await ErrorsModule.handleError(error);

		expect(printExpectedErrorMessage.calledOnce).to.be.true;
		expect(printExpectedErrorMessage.getCall(0).args[0]).to.equal(errorMessage);

		expect(printErrorMessage.notCalled).to.be.true;
		expect(captureException.notCalled).to.be.true;
		expect(processExit.notCalled).to.be.true;
	});

	it('should process unexpected errors correctly (no debug)', async () => {
		const errorMessage = 'an unexpected error';
		await ErrorsModule.handleError(new Error(errorMessage));

		expect(printErrorMessage.calledOnce).to.be.true;
		expect(printErrorMessage.getCall(0).args[0]).to.equal(errorMessage);
		expect(captureException.calledOnce).to.be.true;
		expect(processExit.calledOnce).to.be.true;

		expect(printExpectedErrorMessage.notCalled);
	});

	it('should process thrown strings correctly', async () => {
		const error = 'an thrown string';
		await ErrorsModule.handleError(error);

		expect(printErrorMessage.calledOnce).to.be.true;
		expect(printErrorMessage.getCall(0).args[0]).to.equal(error);
		expect(captureException.calledOnce).to.be.true;
		expect(processExit.calledOnce).to.be.true;

		expect(printExpectedErrorMessage.notCalled);
	});

	it('should process unexpected errors correctly (debug)', async () => {
		sandbox.stub(process, 'env').value({ DEBUG: true });

		const errorMessage = 'an unexpected error';
		const error = new Error(errorMessage);
		await ErrorsModule.handleError(error);

		const expectedMessage = errorMessage + '\n\n' + error.stack;

		expect(printErrorMessage.calledOnce).to.be.true;
		expect(printErrorMessage.getCall(0).args[0]).to.equal(expectedMessage);
		expect(captureException.calledOnce).to.be.true;
		expect(processExit.calledOnce).to.be.true;

		expect(printExpectedErrorMessage.notCalled);
	});

	const messagesToMatch = [
		'Missing 1 required argument', // oclif
		'Missing 2 required arguments', // oclif
		'Missing required flag', // oclif
		'Unexpected argument', // oclif
		'Unexpected arguments', // oclif
		'to be one of', // oclif
		'must also be provided when using', // oclif
		'Expected an integer', // oclif
		'Flag --foo expects a value', // oclif
		'BalenaRequestError: Request error: Unauthorized', // sdk
	];

	messagesToMatch.forEach((message) => {
		it(`should match as expected: "${message}"`, async () => {
			await ErrorsModule.handleError(new Error(message));

			expect(
				printExpectedErrorMessage.calledOnce,
				`Pattern not expected: ${message}`,
			).to.be.true;

			expect(printErrorMessage.notCalled).to.be.true;
			expect(captureException.notCalled).to.be.true;
			expect(processExit.notCalled).to.be.true;
		});
	});

	const typedErrorsToMatch = [
		new BalenaAmbiguousApplication('test'),
		new BalenaApplicationNotFound('test'),
		new BalenaDeviceNotFound('test'),
		new BalenaExpiredToken('test'),
	];

	typedErrorsToMatch.forEach((typedError) => {
		it(`should treat typedError ${typedError.name} as expected`, async () => {
			await ErrorsModule.handleError(typedError);

			expect(printExpectedErrorMessage.calledOnce).to.be.true;

			expect(printErrorMessage.notCalled).to.be.true;
			expect(captureException.notCalled).to.be.true;
			expect(processExit.notCalled).to.be.true;
		});
	});
});

describe('printErrorMessage() function', () => {
	it('should correctly output message', () => {
		const consoleError = sinon.spy(console, 'error');

		const errorMessageLines = [
			'first line should be red',
			'second line should not be red',
			'third line should not be red',
		];

		const inputMessage = errorMessageLines.join('\n');
		const expectedOutputMessages = [
			red(errorMessageLines[0]),
			errorMessageLines[1],
			errorMessageLines[2],
		];

		ErrorsModule.printErrorMessage(inputMessage);

		expect(consoleError.callCount).to.equal(4);
		expect(consoleError.getCall(0).args[0]).to.equal(expectedOutputMessages[0]);
		expect(consoleError.getCall(1).args[0]).to.equal(expectedOutputMessages[1]);
		expect(consoleError.getCall(2).args[0]).to.equal(expectedOutputMessages[2]);
		expect(consoleError.getCall(3).args[0]).to.equal(`\n${getHelp()}\n`);

		consoleError.restore();
	});
});

describe('printExpectedErrorMessage() function', () => {
	it('should correctly output message', () => {
		const consoleError = sinon.spy(console, 'error');

		const errorMessage = ['first line', 'second line'].join('\n');

		ErrorsModule.printExpectedErrorMessage(errorMessage);

		expect(consoleError.calledOnce).to.be.true;
		expect(consoleError.getCall(0).args[0]).to.equal(errorMessage + '\n');

		consoleError.restore();
	});
});
