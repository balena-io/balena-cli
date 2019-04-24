import { BalenaSDK } from 'balena-sdk';
import memoize = require('lodash/memoize');

export const serviceIdToName = memoize(
	async (sdk: BalenaSDK, serviceId: number): Promise<string | undefined> => {
		const serviceName = await sdk.pine.get({
			resource: 'service',
			id: serviceId,
			options: {
				$select: 'service_name',
			},
		});

		if (serviceName != null) {
			return serviceName.service_name;
		}
		return;
	},
	// Memoize the call based on service id
	(_sdk, id) => id.toString(),
);
