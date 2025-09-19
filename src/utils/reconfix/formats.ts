/**
 * @summary Supported formats
 * @type Object
 * @constant
 * @private
 */
const SUPPORTED_FORMATS = {
	json: require('./json'),
	ini: require('./ini'),
};

/**
 * @summary Check that a format type is valid
 * @function
 * @private
 *
 * @param {String} type - type
 * @throws Will throw is type is invalid
 *
 * @example
 * checkType('json');
 */
const checkType = (type) => {
	if (!_.has(SUPPORTED_FORMATS, type)) {
		throw new Error(`Unsupported type: ${type}`);
	}
};

/**
 * @summary Serialise an object according to a format type
 * @function
 * @public
 *
 * @param {String} type - format type
 * @param {Object} object - input object
 * @returns {String} serialised text
 *
 * @example
 * const text = formats.serialise('ini', { foo: 'bar' });
 * console.log(text):
 * > 'foo=bar'
 */
export const serialise = (type, object) => {
	checkType(type);
	return SUPPORTED_FORMATS[type].serialise(object);
};
