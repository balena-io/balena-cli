import * as _ from 'lodash';

const SUPPORTED_FORMATS: Record<string, any> = {
	json: require('./json'),
	ini: require('./ini'),
};

/**
 * @summary Check that a format type is valid
 *
 * @throws Will throw is type is invalid
 *
 * @example
 * checkType('json');
 */
const checkType = (type: string) => {
	if (!_.has(SUPPORTED_FORMATS, type)) {
		throw new Error(`Unsupported type: ${type}`);
	}
};

/**
 * @summary Serialise an object according to a format type
 *
 * @example
 * const text = formats.serialise('ini', { foo: 'bar' });
 * console.log(text):
 * > 'foo=bar'
 */
export const serialise = (type: string, object: object) => {
	checkType(type);
	return SUPPORTED_FORMATS[type].serialise(object);
};
