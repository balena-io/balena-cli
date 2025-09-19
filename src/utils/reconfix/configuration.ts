import { readImageConfiguration, writeImageConfiguration } from './filesystem';
import * as _ from 'lodash';
import { compile, decompile, matches } from './jsontemplate';

/**
 * @summary Get all unique domain filenames
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
const getDomainFilenames = (domain: Array<any>[]) => {
	return _.uniqBy(
		_.map(domain, (domainPath) => {
			return _.initial(domainPath);
		}),
		_.isEqual,
	);
};

/**
 * @summary Extract configuration
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
const extract = (schema: object, configuration: object) => {
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
 *
 * @example
 * readConfiguration({ ... }, 'path/to/image.img').then((configuration) => {
 *   console.log(configuration);
 * });
 */
export const readConfiguration = (
	schema: { files: any; mapper: any },
	image: string,
) => {
	return readImageConfiguration(schema.files, image).then(
		_.partial(extract, schema.mapper),
	);
};

/**
 * @summary Safely merge an object to a certain path
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
const mergePath = (
	destination: object,
	path: (string | number)[],
	source: object,
) => {
	if (!_.has(destination, path)) {
		_.set(destination, path, {});
	}

	_.merge(_.get(destination, path), source);
};

/**
 * @summary Generate configuration
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
const generate = (
	schema: object,
	settings: object,
	options: { defaults?: object },
) => {
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
export const writeConfiguration = (
	schema: { files: any; mapper: any },
	object: object,
	image: string,
) => {
	return readImageConfiguration(schema.files, image).then((current) => {
		const data = generate(schema.mapper, object, {
			defaults: current,
		});

		return writeImageConfiguration(schema.files, image, data);
	});
};
