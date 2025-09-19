import { readImageConfiguration, writeImageConfiguration } from './filesystem';
import * as _ from 'lodash';
import { compile, decompile, matches } from './jsontemplate';

/**
 * @summary Get all unique domain filenames
 * @function
 * @private
 *
 * @param {Array[]} domain - domain
 * @returns {Array[]} unique domain filenames
 *
 * @example
 * const filenames = getDomainFilenames([
 *   [ 'foo', 'bar' ]
 *   [ 'foo', 'baz' ]
 * ]);
 *
 * console.log(filenames);
 * > [ 'foo' ]
 */
const getDomainFilenames = (domain) => {
	return _.uniqBy(
		_.map(domain, (domainPath) => {
			return _.initial(domainPath);
		}),
		_.isEqual,
	);
};

/**
 * @summary Extract configuration
 * @function
 * @public
 *
 * @param {Object} schema - configuration schema
 * @param {Object} configuration - configuration object
 * @returns {Object} user settings
 *
 * @example
 * const settings = configuration.extract([
 *   {
 *     template: {
 *       gpu_mem_1024: '{{gpuMem1024}}'
 *     },
 *     domain: [
 *       [ 'config_txt', 'gpu_mem_1024' ]
 *     ]
 *   }
 * ], {
 *   config_txt: {
 *     gpu_mem_1024: 64
 *   }
 * });
 *
 * console.log(settings);
 * > {
 * >   gpuMem1024: 64
 * > }
 */
const extract = (schema, configuration) => {
	return _.reduce(
		schema,
		(accumulator, correspondence) => {
			const domainFilenamesPaths = getDomainFilenames(correspondence.domain);

			_.each(domainFilenamesPaths, (domainFilenamePath) => {
				const domain = _.get(configuration, domainFilenamePath);

				if (correspondence.choice) {
					const $matches = _.filter(correspondence.choice, (choice) => {
						return matches(choice.template, domain);
					});

					if ($matches.length !== 1) {
						throw new Error(
							[
								"The current state doesn't match the schema.",
								'',
								'Current configuration:',
								'',
								JSON.stringify(domain, null, 2),
								'',
								'Schema choices:',
								'',
								JSON.stringify(correspondence.choice, null, 2),
							].join('\n'),
						);
					}

					const match = _.first($matches);

					_.set(accumulator, correspondence.property, match.value);
					correspondence.template = match.template;
				}

				_.merge(accumulator, decompile(correspondence.template, domain));
			});

			return accumulator;
		},
		{},
	);
};

/**
 * @summary Read image configuration
 * @function
 * @public
 *
 * @param {Object} schema - schema
 * @param {String} image - path to image
 * @fulfil {Object} - configuration
 * @returns {Promise}
 *
 * @example
 * readConfiguration({ ... }, 'path/to/image.img').then((configuration) => {
 *   console.log(configuration);
 * });
 */
export const readConfiguration = (schema, image) => {
	return readImageConfiguration(schema.files, image).then(
		_.partial(extract, schema.mapper),
	);
};

/**
 * @summary Safely merge an object to a certain path
 * @function
 * @private
 *
 * @param {Object} destination - destination object
 * @param {(String|String[])} path - object path
 * @param {Object} source - source object
 *
 * @example
 * const x = {};
 * const y = {
 *   name: 'John Doe'
 * };
 *
 * mergePath(x, [ 'data', 'foo' ], y);
 *
 * console.log(x);
 * > {
 * >   data: {
 * >     foo: {
 * >       name: 'John Doe'
 * >     }
 * >   }
 * > }
 */
const mergePath = (destination, path, source) => {
	if (!_.has(destination, path)) {
		_.set(destination, path, {});
	}

	_.merge(_.get(destination, path), source);
};

/**
 * @summary Generate configuration
 * @function
 * @public
 *
 * @param {Object} schema - configuration schema
 * @param {Object} settings - user settings
 * @param {Object} [options] - options
 * @param {Object} [options.defaults] - default data
 * @returns {Object} configuration
 *
 * @example
 * const result = generate([
 *   {
 *     template: {
 *       gpu_mem_1024: '{{gpuMem1024}}'
 *     },
 *     domain: [
 *       [ 'config_txt', 'gpu_mem_1024' ]
 *     ]
 *   }
 * ], {
 *   gpuMem1024: 64
 * });
 *
 * console.log(result);
 * > {
 * >   config_txt: {
 * >     gpu_mem_1024: 64
 * >   }
 * > }
 */
const generate = (schema, settings, options) => {
	options = options || {};
	_.defaults(options, {
		defaults: {},
	});

	return _.reduce(
		schema,
		(accumulator, correspondence) => {
			const domainFilenamesPaths = getDomainFilenames(correspondence.domain);

			_.each(domainFilenamesPaths, (domainFilenamePath) => {
				if (correspondence.choice) {
					correspondence.template = _.find(correspondence.choice, {
						value: _.get(settings, correspondence.property),
					}).template;
				}

				const configuration = compile(correspondence.template, settings);

				mergePath(
					accumulator,
					domainFilenamePath,
					_.attempt(() => {
						if (correspondence.choice) {
							return configuration;
						}

						const current = _.get(options.defaults, domainFilenamePath, {});
						return _.merge(current, configuration);
					}),
				);
			});

			return accumulator;
		},
		{},
	);
};

/**
 * @summary Write image configuration
 * @function
 * @public
 *
 * @param {Object} schema - schema
 * @param {Object} object - configuration object
 * @param {String} image - path to image
 * @returns {Promise}
 *
 * @example
 * writeConfiguration({ ... }, {
 *   setting1: 'value',
 *   setting2: 'value',
 *   setting3: 'value'
 * }, 'path/to/image.img').then(() => {
 *   console.log('Done!');
 * });
 */
export const writeConfiguration = (schema, object, image) => {
	return readImageConfiguration(schema.files, image).then((current) => {
		const data = generate(schema.mapper, object, {
			defaults: current,
		});

		return writeImageConfiguration(schema.files, image, data);
	});
};
