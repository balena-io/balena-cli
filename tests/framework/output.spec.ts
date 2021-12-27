/**
 * @license
 * Copyright 2020-2021 Balena Ltd.
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

/* tslint:disable: prefer-const no-empty */

import rewire = require('rewire');
import sinon = require('sinon');
import { expect } from 'chai';

const dataItem = {
	name: 'item1',
	id: 1,
	thing_color: 'blue',
	thing_shape: 'square',
};

const dataSet = [
	{
		name: 'item1',
		id: 1,
		thing_color: 'red',
		thing_shape: 'square',
	},
	{
		name: 'item2',
		id: 2,
		thing_color: 'blue',
		thing_shape: 'round',
	},
];

describe('outputData', function () {
	let outputData: any;
	let outputDataSetSpy: any;
	let outputDataItemSpy: any;

	this.beforeEach(() => {
		const output = rewire('../../build/framework/output');

		outputDataSetSpy = sinon.spy();
		outputDataItemSpy = sinon.spy();

		output.__set__('outputDataSet', outputDataSetSpy);
		output.__set__('outputDataItem', outputDataItemSpy);

		outputData = output.__get__('outputData');
	});

	it('should call outputDataSet function when data param is an array', async () => {
		await outputData(dataSet);
		expect(outputDataSetSpy.called).to.be.true;
		expect(outputDataItemSpy.called).to.be.false;
	});

	it('should call outputDataItem function when data param is an object', async () => {
		await outputData(dataItem);
		expect(outputDataSetSpy.called).to.be.false;
		expect(outputDataItemSpy.called).to.be.true;
	});
});

describe('outputDataSet', function () {
	let outputDataSet: any;
	let printLineSpy: any;

	this.beforeEach(() => {
		const output = rewire('../../build/framework/output');
		printLineSpy = sinon.spy();
		output.__set__('printLine', printLineSpy);
		outputDataSet = output.__get__('outputDataSet');
	});

	it('should only output fields specified in `fields` param, in that order', async () => {
		const fields = ['id', 'name', 'thing_color'];
		const options = {};

		await outputDataSet(dataSet, fields, options);

		// check correct number of rows (2 data, 2 header)
		expect(printLineSpy.callCount).to.equal(4);
		const headerLine = printLineSpy.firstCall.firstArg.toLowerCase();
		// check we have fields we specified
		fields.forEach((f) => {
			expect(headerLine).to.include(f.replace(/_/g, ' '));
		});
		// check we don't have fields we didn't specify
		expect(headerLine).to.not.include('thing_shape');
		// check order
		// split header using the `name` column as delimiter
		const splitHeader = headerLine.split('name');
		expect(splitHeader[0]).to.include('id');
		expect(splitHeader[1]).to.include('thing');
	});

	it('should only output fields specified in `options.fields` if present', async () => {
		const fields = ['name', 'id', 'thing_color', 'thing_shape'];
		const options = {
			// test all formats
			fields: 'Name,thing_color,Thing shape',
		};

		await outputDataSet(dataSet, fields, options);

		const headerLine = printLineSpy.firstCall.firstArg.toLowerCase();
		// check we have fields we specified
		expect(headerLine).to.include('name');
		expect(headerLine).to.include('thing color');
		expect(headerLine).to.include('thing shape');
		// check we don't have fields we didn't specify
		expect(headerLine).to.not.include('id');
	});

	it('should output records in order specified by `options.sort` if present', async () => {
		const fields = ['name', 'id', 'thing_color', 'thing_shape'];
		const options = {
			sort: 'thing shape',
			'no-header': true,
		};

		await outputDataSet(dataSet, fields, options);

		// blue should come before red
		expect(printLineSpy.getCall(0).firstArg).to.include('blue');
		expect(printLineSpy.getCall(1).firstArg).to.include('red');
	});

	it('should only output records that match filter specified by `options.filter` if present', async () => {
		const fields = ['name', 'id', 'thing_color', 'thing_shape'];
		const options = {
			filter: 'thing color=red',
			'no-header': true,
		};

		await outputDataSet(dataSet, fields, options);

		// check correct number of rows (1 matched data, no-header)
		expect(printLineSpy.callCount).to.equal(1);
		expect(printLineSpy.getCall(0).firstArg).to.include('red');
	});

	it(
		'should output `null` values using the provided value, ' +
			'if `options.displayNullValuesAs` is present',
		async () => {
			const fields = ['name', 'id', 'thing_color', 'thing_shape'];
			const nullValue = 'N/a';
			const options = {
				'no-header': true,
				displayNullValuesAs: nullValue,
			};

			const extendedDataSet = [
				...dataSet,
				{
					name: 'item3',
					id: 3,
					thing_color: null,
					thing_shape: 'round',
				},
			];

			await outputDataSet(extendedDataSet, fields, options);

			expect(printLineSpy.callCount).to.equal(3);
			expect(printLineSpy.getCall(2).firstArg).to.include(nullValue);
		},
	);

	it('should output data in json format, if `options.json` true', async () => {
		const fields = ['name', 'thing_color', 'thing_shape'];
		const options = {
			json: true,
		};

		// TODO: I've run into an oclif cli-ux bug, where all types (number. bool etc.) are output as strings in json
		//  (this can be seen by including 'id' in the fields list above).
		//  Issue opened: https://github.com/oclif/cli-ux/issues/309
		//  For now removing id for this test.
		const clonedDataSet = JSON.parse(JSON.stringify(dataSet));
		clonedDataSet.forEach((d: any) => {
			delete d.id;
		});

		const expectedJson = JSON.stringify(clonedDataSet, undefined, 2);

		await outputDataSet(dataSet, fields, options);

		expect(printLineSpy.callCount).to.equal(1);
		expect(printLineSpy.getCall(0).firstArg).to.equal(expectedJson);
	});
});

describe('outputDataItem', function () {
	let outputDataItem: any;
	let printLineSpy: any;

	this.beforeEach(() => {
		const output = rewire('../../build/framework/output');
		printLineSpy = sinon.spy();
		output.__set__('printLine', printLineSpy);
		outputDataItem = output.__get__('outputDataItem');
	});

	it('should only output fields specified in `fields` param, in that order', async () => {
		const fields = ['id', 'name', 'thing_color'];
		const options = {};

		await outputDataItem(dataItem, fields, options);

		// check correct number of rows (3 fields)
		expect(printLineSpy.callCount).to.equal(3);
		// check we have fields we specified
		fields.forEach((f, index) => {
			const kvPair = printLineSpy.getCall(index).firstArg.split(':');
			expect(kvPair[0].toLowerCase()).to.include(f.replace(/_/g, ' '));
			expect(kvPair[1]).to.include((dataItem as any)[f]);
		});
	});

	it('should only output fields specified in `options.fields` if present', async () => {
		const fields = ['name', 'id', 'thing_color', 'thing_shape'];
		const options = {
			// test all formats
			fields: 'Name,thing_color,Thing shape',
		};

		const expectedFields = ['name', 'thing_color', 'thing_shape'];

		await outputDataItem(dataItem, fields, options);

		// check correct number of rows (3 fields)
		expect(printLineSpy.callCount).to.equal(3);
		// check we have fields we specified
		expectedFields.forEach((f, index) => {
			const kvPair = printLineSpy.getCall(index).firstArg.split(':');
			expect(kvPair[0].toLowerCase()).to.include(f.replace(/_/g, ' '));
			expect(kvPair[1]).to.include((dataItem as any)[f]);
		});
	});

	it('should output data in json format, if `options.json` true', async () => {
		const fields = ['name', 'id', 'thing_color', 'thing_shape'];
		const options = {
			json: true,
		};

		const expectedJson = JSON.stringify(dataItem, undefined, 2);

		await outputDataItem(dataItem, fields, options);

		expect(printLineSpy.callCount).to.equal(1);
		expect(printLineSpy.getCall(0).firstArg).to.equal(expectedJson);
	});
});
