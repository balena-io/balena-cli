import Bonjour from 'bonjour-service';
import type { Service } from 'bonjour-service';
import * as os from 'os';

interface LocalBalenaOsDevice {
	address: string;
	host: string;
	osVariant?: string;
	port: number;
}

const avahiBalenaSshConfig = {
	type: 'ssh',
	name: '_resin-device._sub',
	protocol: 'tcp' as const,
};

const avahiBalenaSshSubtype = 'resin-device';

export async function discoverLocalBalenaOsDevices(
	timeout = 4000,
): Promise<LocalBalenaOsDevice[]> {
	// search over all network interfaces
	const networks = os.networkInterfaces();
	const validNics: os.NetworkInterfaceInfo[] = [];
	for (const networkName of Object.keys(networks)) {
		for (const iface of networks[networkName]!) {
			if (isIPv4(iface.family) && !iface.internal) {
				validNics.push(iface);
			}
		}
	}

	const allServices = await Promise.all(
		validNics.map((iface) => searchBalenaDevicesOnInterface(iface, timeout)),
	);

	// dedupe services in case the same device is found on multiple interfaces
	const services = Array.from(
		new Map(allServices.flat().map((item) => [item.fqdn, item])).values(),
	);

	return services
		.filter(
			({ subtypes, referer }) =>
				subtypes?.includes(avahiBalenaSshSubtype) && referer != null,
		)
		.map(({ referer, host, port }) => ({
			// We ensure referer is not null on the filter above
			address: referer!.address,
			host,
			port,
		}));
}

async function searchBalenaDevicesOnInterface(
	iface: os.NetworkInterfaceInfo,
	timeout: number,
): Promise<Service[]> {
	return await new Promise<Service[]>((resolve) => {
		const bonjour = new Bonjour(
			{
				// @ts-expect-error bonjour-service types are incorrect https://github.com/onlxltd/bonjour-service/issues/10
				interface: iface.address,
				// binds to receive from any incoming interface
				// see: https://github.com/mafintosh/multicast-dns/issues/53#issuecomment-638365104
				bind: '0.0.0.0',
			},
			async (err: string | Error) => {
				await (await import('../errors')).handleError(err);
			},
		);
		const resinSshServices: Service[] = [];
		const browser = bonjour.find(avahiBalenaSshConfig, (service) =>
			resinSshServices.push(service),
		);
		setTimeout(() => {
			browser.stop();
			bonjour.destroy();
			resolve(resinSshServices);
		}, timeout);
	});
}

function isIPv4(family: string | number) {
	return family === 4 || family === 'IPv4';
}
