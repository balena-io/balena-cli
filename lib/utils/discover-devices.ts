import * as Promise from 'bluebird';
import * as _ from 'lodash';
import * as sdk from 'balena-sdk';
import { enumerateServices, findServices } from 'resin-discoverable-services';
const balena = sdk.fromSharedOptions();

// Although we only check for 'balena-ssh', we know, implicitly, that balenaOS
// devices come with 'rsync' installed that can be used over SSH.
const avahiBalenaSshTag = 'resin-ssh';

export const discoverLocalBalenaOsDevices = function (timeout: number = 4000) {
	return enumerateServices()
		.then((availableServices) =>
			availableServices
				.filter((s) => Array.from(s.tags).includes(avahiBalenaSshTag))
				.map((s) => s.service),
		)
		.then(function (services) {
			if (services == null || services.length === 0) {
				throw new Error(
					`Could not find any available '${avahiBalenaSshTag}' services`,
				);
			}

			return findServices(services, timeout);
		})
		.then((services) =>
			_.map(services, function (service) {
				// User referer address to get device IP. This will work fine assuming that
				// a device only advertises own services.
				const {
					referer: { address },
					host,
					port,
				} = service;

				return { address, host, port };
			}),
		);
};

// Resolves with array of remote online balena devices, throws on error
export const getRemoteBalenaOnlineDevices = () =>
	Promise.resolve(
		balena.models.device.getAll({ $filter: { is_online: true } }),
	);
