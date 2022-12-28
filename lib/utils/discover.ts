import { enumerateServices, findServices } from 'resin-discoverable-services';

interface LocalBalenaOsDevice {
	address: string;
	host: string;
	osVariant?: string;
	port: number;
}

// Although we only check for 'balena-ssh', we know, implicitly, that balenaOS
// devices come with 'rsync' installed that can be used over SSH.
const avahiBalenaSshTag = 'resin-ssh';

export async function discoverLocalBalenaOsDevices(
	timeout = 4000,
): Promise<LocalBalenaOsDevice[]> {
	const availableServices = await enumerateServices();
	const serviceDefinitions = Array.from(availableServices)
		.filter((s) => Array.from(s.tags).includes(avahiBalenaSshTag))
		.map((s) => s.service);

	if (serviceDefinitions.length === 0) {
		throw new Error(
			`Could not find any available '${avahiBalenaSshTag}' services`,
		);
	}

	const services = await findServices(serviceDefinitions, timeout);
	return services.map(function (service) {
		// User referer address to get device IP. This will work fine assuming that
		// a device only advertises own services.
		const {
			referer: { address },
			host,
			port,
		} = service;

		return { address, host, port };
	});
}
