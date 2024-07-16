import { Bonjour } from 'bonjour-service';
import type { Service } from 'bonjour-service';

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
	const services = await new Promise<Service[]>((resolve) => {
		const bonjour = new Bonjour({}, async (err: string | Error) => {
			await (await import('../errors.js')).handleError(err);
		});
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
