/*
 * Copyright 2016 Resin.io
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

'use strict';

/**
 * @module Reconfix.Engine.Formats.INI
 */

import * as _ from 'lodash';
import ini from 'ini';

/**
 * @summary Check if a string represents a number
 *
 * @description
 * Adapted from https://github.com/substack/minimist.
 *
 * @example
 * if (isNumber('3.45')) {
 *   console.log('This string represents a number');
 * }
 */
const isNumber = (str: string) => {
	if (_.isNumber(str) || /^0x[0-9a-f]+$/i.test(str)) {
		return true;
	}

	return /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(e[-+]?\d+)?$/.test(str);
};

/**
 * @summary Parse a property value
 *
 * @example
 * const value = parseValue('5.1');
 * > value === 5.1;
 */
const parseValue = (value: any): any => {
	if (isNumber(value)) {
		const parsedNumber = parseFloat(value);

		if (_.isNaN(parsedNumber)) {
			return value;
		}

		return parsedNumber;
	}

	if (_.isPlainObject(value)) {
		return _.mapValues(value, parseValue);
	}

	if (_.isArray(value)) {
		return _.map(value, parseValue);
	}

	return value;
};

/**
 * @summary Parse the contents of an INI file
 *
 * @example
 * const result = ini.parse([
 *   '[mysection]',
 *   'foo = bar'
 * ].join('\n'));
 *
 * console.log(result.mysection.foo);
 * > 'bar'
 */
export const parse = (text: string) => {
	text = text.toString().replace(/(.+=.*)(#)(.*)/g, '$1\\#$3');
	return _.mapValues(ini.decode(text), parseValue);
};

/**
 * @summary Serialize a JSON object as an INI file
 *
 * @example
 * const result = ini.serialise({
 *   mysection: {
 *     foo: 'bar'
 *   }
 * });
 *
 * console.log(result);
 * > [mysection]
 * > foo=bar
 */
export const serialise = (object: object) => {
	return ini
		.encode(object)
		.replace(/\n$/, '')
		.replace(/\\#/g, '#')
		.replace(/\r/g, '');
};
