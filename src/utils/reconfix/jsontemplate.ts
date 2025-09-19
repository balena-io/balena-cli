import { deinterpolate, interpolate } from './string';
import * as _ from 'lodash';

/**
 * @summary Check if a compiled object matches a template
 *
 * @example
 * if (matches({
 *   foo: '{{bar}}'
 * }, }
 *   foo: 'bar'
 * )) {
 *   console.log('This is a match!');
 * }
 */
export const matches = (template: object, object: object) => {
	const data = decompile(template, object);

	try {
		return _.isEqual(compile(template, data), object);
	} catch (error) {
		// TODO: Terrible way to match the error.
		// Use an error code instead.
		if (_.startsWith(error.message, 'Missing variable')) {
			return false;
		}

		throw error;
	}
};

/**
 * @summary Decompile a JSON template
 *
 * @example
 * const data = decompile({
 *   greeting: 'Hello, {{name}}!'
 * }, {
 *   greeting: 'Hello, John Doe!'
 * });
 *
 * console.log(data);
 * > {
 * >   name: 'John Doe'
 * > }
 */
export const decompile = (template: object, result: object) => {
	return _.reduce(
		template,
		(data, value, key) => {
			const stringValue = _.get(result, key);

			if (_.isPlainObject(value)) {
				_.merge(data, decompile(value, stringValue));
			}

			if (_.isString(value)) {
				_.merge(data, deinterpolate(value, stringValue));
			}

			return data;
		},
		{},
	);
};

/**
 * @summary Compile a JSON template
 *
 * @example
 * const result = compile({
 *   greeting: 'Hello, {{name}}!'
 * }, {
 *   name: 'John Doe'
 * });
 *
 * console.log(result);
 * > {
 * >   greeting: 'Hello, John Doe!'
 * > }
 */
export const compile = (template: object, data: object) => {
	return _.mapValues(template, (value) => {
		if (_.isPlainObject(value)) {
			return exports.compile(value, data);
		}

		if (_.isString(value)) {
			return interpolate(value, data);
		}

		return value;
	});
};
