import { ExpectedError } from '../errors';
import { getBalenaSdk } from './lazy';

export interface FlagsDef {
	organization?: string;
	type?: string; // application device type
}

export interface ArgsDef {
	name: string;
}

export async function applicationCreateBase(
	resource: 'fleet' | 'app' | 'block',
	options: FlagsDef,
	params: ArgsDef,
) {
	// Ascertain device type
	const deviceType =
		options.type || (await (await import('./patterns')).selectDeviceType());

	// Ascertain organization
	const organization =
		options.organization?.toLowerCase() ||
		(await (await import('./patterns')).getAndSelectOrganization());

	// Create application
	try {
		const application = await getBalenaSdk().models.application.create({
			name: params.name,
			deviceType,
			organization,
			applicationClass: resource,
		});

		// Output
		const { capitalize } = await import('lodash');
		console.log(
			`${capitalize(resource)} created: slug "${
				application.slug
			}", device type "${deviceType}"`,
		);
	} catch (err) {
		if ((err.message || '').toLowerCase().includes('unique')) {
			// BalenaRequestError: Request error: "organization" and "app_name" must be unique.
			throw new ExpectedError(
				`Error: An app or block or fleet with the name "${params.name}" already exists in organization "${organization}".`,
			);
		} else if ((err.message || '').toLowerCase().includes('unauthorized')) {
			// BalenaRequestError: Request error: Unauthorized
			throw new ExpectedError(
				`Error: You are not authorized to create ${resource}s in organization "${organization}".`,
			);
		}

		throw err;
	}
}
