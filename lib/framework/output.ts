/*
Copyright 2020 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import { getCliUx, getChalk } from '../utils/lazy.js';

export interface DataOutputOptions {
	fields?: string;
	json?: boolean;
}

export interface DataSetOutputOptions extends DataOutputOptions {
	filter?: string;
	'no-header'?: boolean;
	'no-truncate'?: boolean;
	sort?: string;
}

/**
 * Output message to STDERR
 */
export function outputMessage(msg: string) {
	// Messages go to STDERR
	console.error(msg);
}

/**
 * Output result data to STDOUT
 *  Supports:
 *   - arrays of items (displayed in a tabular way),
 *   - single items (displayed in a field per row format).
 *
 * @param data Array of data objects to output
 * @param fields Array of fieldnames, specifying the fields and display order
 * @param options Output options
 */
export async function outputData(
	data: any[] | object,
	fields: string[],
	options: DataOutputOptions | DataSetOutputOptions,
) {
	if (Array.isArray(data)) {
		await outputDataSet(data, fields, options as DataSetOutputOptions);
	} else {
		await outputDataItem(data, fields, options as DataOutputOptions);
	}
}

/**
 * Wraps the cli.ux table implementation, to output tabular data
 *
 * @param data Array of data objects to output
 * @param fields Array of fieldnames, specifying the fields and display order
 * @param options Output options
 */
async function outputDataSet(
	data: any[],
	fields: string[],
	options: DataSetOutputOptions,
) {
	// Oclif expects fields to be specified in the format used in table headers (though lowercase)
	// By replacing underscores with spaces here, we can support both header format and actual field name
	// (e.g. as seen in json output).
	options.fields = options.fields?.replace(/_/g, ' ');
	options.filter = options.filter?.replace(/_/g, ' ');
	options.sort = options.sort?.replace(/_/g, ' ');

	getCliUx().table(
		data,
		// Convert fields array to column object keys
		// that cli.ux expects.  We can later add support
		// for both formats if beneficial
		fields.reduce((ac, a) => ({ ...ac, [a]: {} }), {}),
		{
			...options,
			...(options.json
				? {
						output: 'json',
					}
				: {}),
			columns: options.fields,
			printLine,
		},
	);
}

/**
 * Outputs a single data object (like `resin-cli-visuals table.vertical`),
 *  but supporting a subset of options from `cli-ux table` (--json and --fields)
 *
 * @param data Array of data objects to output
 * @param fields Array of fieldnames, specifying the fields and display order
 * @param options Output options
 */
async function outputDataItem(
	data: any,
	fields: string[],
	options: DataOutputOptions,
) {
	const outData: typeof data = {};

	// Convert comma separated list of fields in `options.fields` to array of correct format.
	// Note, user may have specified the true field name (e.g. `some_field`),
	// or the format displayed in headers (e.g. `Some field`, case insensitive).
	const userSelectedFields = options.fields?.split(',').map((f) => {
		return f.toLowerCase().trim().replace(/ /g, '_');
	});

	// Order and filter the fields based on `fields` parameter and `options.fields`
	(userSelectedFields || fields).forEach((fieldName) => {
		if (fields.includes(fieldName)) {
			outData[fieldName] = data[fieldName];
		}
	});

	if (options.json) {
		printLine(JSON.stringify(outData, undefined, 2));
	} else {
		const chalk = getChalk();
		const { capitalize } = await import('lodash');

		// Find longest key, so we can align results
		const longestKeyLength = getLongestObjectKeyLength(outData);

		// Output one field per line
		for (const [k, v] of Object.entries(outData)) {
			const shim = ' '.repeat(longestKeyLength - k.length);
			const kDisplay = capitalize(k.replace(/_/g, ' '));
			printLine(`${chalk.bold(kDisplay) + shim} : ${v}`);
		}
	}
}

function getLongestObjectKeyLength(o: any): number {
	return Object.keys(o).length >= 1
		? Object.keys(o).reduce((a, b) => {
				return a.length > b.length ? a : b;
			}).length
		: 0;
}

function printLine(s: any) {
	// Duplicating oclif cli-ux's default implementation here,
	// but using this one explicitly for ease of testing
	process.stdout.write(s + '\n');
}
