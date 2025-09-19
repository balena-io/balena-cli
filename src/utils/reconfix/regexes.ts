import * as _ from 'lodash';

/**
 * @summary RegExp string portions
 * @type {Object}
 * @constant
 * @public
 */
export const REGEX = {
	capturingType: '((\\w+):)?',
	nonCapturingType: '(?:\\w+:)?',
	property: '([\\w$_\\.\\[\\]]+)',
	openDelimiters: '{{',
	closeDelimiters: '}}',
};

/**
 * @summary Bounded interpolation RegExp
 * @type RegExp
 * @constant
 * @pblic
 */
export const BOUNDED_INTERPOLATION = new RegExp(
	[
		'^',
		REGEX.openDelimiters,
		REGEX.capturingType,
		REGEX.property,
		REGEX.closeDelimiters,
		'$',
	].join(''),
);

/**
 * @summary Unbounded interpolation RegExp
 * @type RegExp
 * @constant
 * @public
 */
export const UNBOUNDED_INTERPOLATION = new RegExp(
	[
		REGEX.openDelimiters,
		REGEX.capturingType,
		REGEX.property,
		REGEX.closeDelimiters,
	].join(''),
	'g',
);

/**
 * @summary Lodash template interpolation RegExp
 * @type RegExp
 * @constant
 * @public
 *
 * We need to make a special regular expression without a capturing
 * group on the type section, since `_.template` will get confused
 * if there is more than one capturing group.
 */
export const TEMPLATE_INTERPOLATION = new RegExp(
	[
		REGEX.openDelimiters,
		REGEX.nonCapturingType,
		REGEX.property,
		REGEX.closeDelimiters,
	].join(''),
	'g',
);

/**
 * @summary Execute interpolation regex
 * @function
 * @public
 *
 * @param {RegExp} regex - interpolation regex
 * @param {String} template - template string
 * @returns {Object} interpolation details
 *
 * @example
 * const interpolation = regexes.execute(regexes.BOUNDED_INTERPOLATION, '{{string:name}}');
 *
 * console.log(interpolation.type);
 * > 'string'
 *
 * console.log(interpolation.property);
 * > 'name'
 */
export const execute = (regex, template) => {
	// Reset global RegExp index
	// See: http://stackoverflow.com/a/11477448/1641422
	regex.lastIndex = 0;

	const matches = regex.exec(template);
	return {
		type: _.nth(matches, 2),
		property: _.nth(matches, 3),
	};
};
