import {
	BOUNDED_INTERPOLATION,
	execute,
	TEMPLATE_INTERPOLATION,
	UNBOUNDED_INTERPOLATION,
} from './regexes';
import * as _ from 'lodash';

/**
 * @summary Transform value to another type
 *
 * @example
 * console.log(transformValue('number', '21'));
 * > 21
 */
const transformValue = (type: string, value: any) => {
	const castFunctions = {
		number: parseFloat,
		string: String,
	};

	const result = _.get(castFunctions, type, _.identity)(value);

	if (_.isNaN(result)) {
		throw new Error(`Can't convert ${value} to ${type}`);
	}

	return result;
};

/**
 * @summary Create a single property object
 *
 * @example
 * console.log(createSinglePropertyObject('foo', 'bar'));
 * > { foo: 'bar' }
 *
 * console.log(createSinglePropertyObject('foo.baz', 'bar'));
 * > { foo: { bar: 'baz' } }
 */
const createSinglePropertyObject = (key: string, value: any) => {
	const object = {};

	// `_.set` ensures that if `key` is a path
	// (e.g: `foo.bar.baz`), it will be expanded correctly.
	_.set(object, key, value);

	return object;
};

/**
 * @summary Deinterpolate a string
 *
 * @description
 * The gist of this function is: `(template, string) => data`
 *
 * @example
 * console.log(deinterpolate('Hello, {{name}}!', 'Hello, John Doe!');
 * > {
 * >   name: 'John Doe'
 * > }
 */
export const deinterpolate = (template: string, string: any) => {
	if (BOUNDED_INTERPOLATION.test(template)) {
		const interpolation = execute(BOUNDED_INTERPOLATION, template);
		return createSinglePropertyObject(
			interpolation.property,
			transformValue(interpolation.type, string),
		);
	}

	const templateRegexString = template.replace(UNBOUNDED_INTERPOLATION, '(.+)');
	const templateRegex = new RegExp(templateRegexString);
	const allExpressions = template.match(UNBOUNDED_INTERPOLATION);
	const allValues = _.tail(templateRegex.exec(string));

	return _.reduce(
		_.zip(allExpressions, allValues),
		(data, pair) => {
			const interpolation = execute(UNBOUNDED_INTERPOLATION, _.first(pair));
			const value = _.last(pair);

			if (_.isUndefined(value)) {
				throw new Error(`No match for '${interpolation.property}'`);
			}

			_.set(
				data,
				interpolation.property,
				transformValue(interpolation.type, value),
			);
			return data;
		},
		{},
	);
};

/**
 * @summary Interpolate a string
 *
 * @description
 * The gist of this function is: `(template, data) => string`
 *
 * @example
 * console.log(interpolate('Hello, {{name}}!', {
 *   name: 'John Doe'
 * }));
 * > 'Hello, John Doe!'
 */
export const interpolate = (template: string, data: object) => {
	if (BOUNDED_INTERPOLATION.test(template)) {
		const interpolation = execute(BOUNDED_INTERPOLATION, template);
		const value = _.get(data, interpolation.property);

		if (_.isUndefined(value) || _.isNull(value)) {
			throw new Error(`Missing variable ${interpolation.property}`);
		}

		return transformValue(interpolation.type, value);
	}

	try {
		return _.template(template, {
			interpolate: TEMPLATE_INTERPOLATION,
		})(data);

		// This is a terrible way to intercept an undefined
		// variable error to give it a better message, but
		// sadly its the best we can to still be able to re-use
		// the `_.template` functionality.
	} catch (error) {
		const undefinedExpression = _.nth(
			/(.*) is not defined/.exec(error.message),
			1,
		);

		if (undefinedExpression) {
			error.message = `Missing variable ${undefinedExpression}`;
		}

		throw error;
	}
};
