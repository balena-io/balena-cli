import * as _ from 'lodash';
import Bluebird = require('bluebird');
import imagefs = require('balena-image-fs');
import { serialise } from './formats';

/**
 * @summary Read image configuration
 * @function
 * @public
 *
 * @param {Object} schema - schema
 * @param {String} image - path to image
 * @fulfil {Object} - image configuration
 * @returns {Promise}
 *
 * @example
 * filesystem.readImageConfiguration({
 *   config_txt: {
 *     type: 'ini',
 *     location: {
 *       path: 'config.txt',
 *       partition: 1
 *     }
 *   }
 * }, 'path/to/image.img').then((configuration) => {
 *   console.log(configuration.config_txt);
 * });
 */
export const readImageConfiguration = (schema, image) => {
	return exports.readImageData(schema, image).then((imageFileDeclarations) => {
		return exports.parseFilesManifest(schema, imageFileDeclarations);
	});
};

/**
 * @summary Generate a files manifest
 * @function
 * @private
 *
 * @param {Object} schema - schema
 * @param {Object} data - file data
 * @returns {Object} manifest
 *
 * @example
 * const manifest = generateFilesManifest({
 *   file1: { ... },
 *   file2: { ... },
 *   file3: { ... }
 * }, {
 *   file1: { ... },
 *   file2: { ... },
 *   file3: { ... }
 * });
 */
const generateFilesManifest = (schema, data) => {
	const keys = _.keys(_.omitBy(schema, exports.isSchemaFileVirtual));
	const rootFiles = _.chain(_.cloneDeep(data))
		.tap((object) => {
			_.each(keys, (key) => {
				if (!_.has(object, key)) {
					_.set(object, key, {});
				}
			});
		})
		.pick(keys)
		.mapValues((fileData, fileId) => {
			return _.set(_.get(schema, fileId), 'data', fileData);
		})
		.value();

	return _.chain(schema)
		.pickBy(exports.isSchemaFileVirtual)
		.reduce((accumulator, fileDeclaration, fileId) => {
			const fileContents = _.get(data, fileId);
			const finalPath = _.concat(
				[fileDeclaration.location.parent, 'data'],
				fileDeclaration.location.property,
			);
			return _.set(
				accumulator,
				finalPath,
				serialise(fileDeclaration.type, fileContents),
			);
		}, rootFiles)
		.mapValues((value) => {
			if (value.fileset) {
				return {
					data: _.mapValues(value.data, (childValue) => {
						return serialise(value.type, childValue);
					}),
					location: value.location,
				};
			}

			return {
				data: serialise(value.type, value.data),
				location: value.location,
			};
		})
		.value();
};

/**
 * @summary Write image data
 * @function
 * @private
 *
 * @param {Object} schema - file schema
 * @param {Object} manifest - file manifest
 * @param {String} image - path to image
 * @returns {Promise}
 *
 * @example
 * writeImageData({
 *   file1: { ... },
 *   file2: { ... },
 *   file3: { ... }
 * },{
 *   file1: { ... },
 *   file2: { ... },
 *   file3: { ... }
 * }, 'path/to/image.img').then(() => {
 *   console.log('Done!');
 * });
 */
const writeImageData = (schema, manifest, image) => {
	return Bluebird.each(_.toPairs(manifest), (filePair) => {
		const fileId = _.first(filePair);
		const fileDeclaration = _.last(filePair);

		if (_.get(schema, fileId).fileset) {
			return Bluebird.each(_.toPairs(fileDeclaration.data), (childFilePair) => {
				const childFileName = _.first(childFilePair);
				const childFileContents = _.last(childFilePair);

				return imagefs.interact(
					image,
					fileDeclaration.location.partition,
					(fs) => {
						const writeFileAsync = Bluebird.promisify(fs.writeFile);
						return writeFileAsync(
							path.join(fileDeclaration.location.path, childFileName),
							childFileContents,
						);
					},
				);
			});
		}

		return imagefs.interact(image, fileDeclaration.location.partition, (fs) => {
			const writeFileAsync = Bluebird.promisify(fs.writeFile);
			return writeFileAsync(
				fileDeclaration.location.path,
				fileDeclaration.data,
			);
		});
	});
};

/**
 * @summary Write image configuration
 * @function
 * @public
 *
 * @param {Object} schema - schema
 * @param {String} image - path to image
 * @param {Object} settings - settings
 * @returns {Promise}
 *
 * @example
 * writeImageConfiguration({
 *   config_txt: {
 *     type: 'ini',
 *     location: {
 *       path: 'config.txt',
 *       partition: 1
 *     }
 *   }
 * }, 'path/to/image.img', {
 *   config_txt: {
 *     foo: 'bar'
 *   }
 * }).then(() => {
 *   console.log('Done!');
 * });
 */
export const writeImageConfiguration = (schema, image, settings) => {
	const manifest = generateFilesManifest(schema, settings);
	return writeImageData(schema, manifest, image);
};
