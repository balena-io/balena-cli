/**
 * @license
 * Copyright 2019 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { flags } from '@oclif/command';
import type * as BalenaSdk from 'balena-sdk';
import Command from '../../command';
import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../../utils/lazy';
import { applicationIdInfo } from '../../utils/messages';

interface FlagsDef {
	fleet?: string;
	device?: string; // device UUID
	help: void;
	quiet: boolean;
	service?: string; // service name
}

interface ArgsDef {
	name: string;
	value?: string;
}

export default class EnvAddCmd extends Command {
	public static description = stripIndent`
		Add env or config variable to fleets, devices or services.

		Add an environment or config variable to one or more fleets, devices or
		services, as selected by the respective command-line options. Either the
		--fleet or the --device option must be provided,  and either may be be
		used alongside the --service option to define a service-specific variable.
		(A service corresponds to a Docker image/container in a microservices fleet.)
		When the --service option is used in conjunction with the --device option,
		the service variable applies to the selected device only.  Otherwise, it
		applies to all devices of the selected fleet. If the --service option is
		omitted, the variable applies to all services.

		If VALUE is omitted, the CLI will attempt to use the value of the environment
		variable of same name in the CLI process' environment. In this case, a warning
		message will be printed. Use \`--quiet\` to suppress it.

		'BALENA_' or 'RESIN_' are reserved variable name prefixes used to identify
		"configuration variables". Configuration variables control balena platform
		features and are treated specially by balenaOS and the balena supervisor
		running on devices. They are also stored differently in the balenaCloud API
		database. Configuration variables cannot be set for specific services,
		therefore the --service option cannot be used when the variable name starts
		with a reserved prefix. When defining custom fleet variables, please avoid
		these reserved prefixes.

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena env add TERM --fleet MyFleet',
		'$ balena env add EDITOR vim -f myorg/myfleet',
		'$ balena env add EDITOR vim --fleet MyFleet,MyFleet2',
		'$ balena env add EDITOR vim --fleet MyFleet --service MyService',
		'$ balena env add EDITOR vim --fleet MyFleet,MyFleet2 --service MyService,MyService2',
		'$ balena env add EDITOR vim --device 7cf02a6',
		'$ balena env add EDITOR vim --device 7cf02a6,d6f1433',
		'$ balena env add EDITOR vim --device 7cf02a6 --service MyService',
		'$ balena env add EDITOR vim --device 7cf02a6,d6f1433 --service MyService,MyService2',
	];

	public static args = [
		{
			name: 'name',
			required: true,
			description: 'environment or config variable name',
		},
		{
			name: 'value',
			required: false,
			description:
				"variable value; if omitted, use value from this process' environment",
		},
	];

	public static usage = 'env add <name> [value]';

	public static flags: flags.Input<FlagsDef> = {
		fleet: { ...cf.fleet, exclusive: ['device'] },
		device: { ...cf.device, exclusive: ['fleet'] },
		help: cf.help,
		quiet: cf.quiet,
		service: cf.service,
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			EnvAddCmd,
		);
		const cmd = this;

		if (!options.fleet && !options.device) {
			throw new ExpectedError(
				'Either the --fleet or the --device option must be specified',
			);
		}

		await Command.checkLoggedIn();

		if (params.value == null) {
			params.value = process.env[params.name];

			if (params.value == null) {
				throw new ExpectedError(
					`Value not found for environment variable: ${params.name}`,
				);
			} else if (!options.quiet) {
				cmd.warn(
					`Using ${params.name}=${params.value} from CLI process environment`,
				);
			}
		}

		const balena = getBalenaSdk();
		const reservedPrefixes = await getReservedPrefixes(balena);
		const isConfigVar = reservedPrefixes.some((prefix) =>
			params.name.startsWith(prefix),
		);

		if (options.service) {
			if (isConfigVar) {
				throw new ExpectedError(stripIndent`
					Configuration variables prefixed with "${reservedPrefixes.join(
						'" or "',
					)}" cannot be set per service.
					Hint: remove the --service option or rename the variable.
				`);
			}
			await setServiceVars(balena, params, options);
			return;
		}

		const varType = isConfigVar ? 'configVar' : 'envVar';
		if (options.fleet) {
			const { getFleetSlug } = await import('../../utils/sdk');
			for (const app of options.fleet.split(',')) {
				try {
					await balena.models.application[varType].set(
						await getFleetSlug(balena, app),
						params.name,
						params.value,
					);
				} catch (err) {
					console.error(`${err.message}, fleet: ${app}`);
					process.exitCode = 1;
				}
			}
		} else if (options.device) {
			for (const device of options.device.split(',')) {
				try {
					await balena.models.device[varType].set(
						device,
						params.name,
						params.value,
					);
				} catch (err) {
					console.error(`${err.message}, device: ${device}`);
					process.exitCode = 1;
				}
			}
		}
	}
}

/**
 * Add service variables for a device or fleet.
 */
async function setServiceVars(
	sdk: BalenaSdk.BalenaSDK,
	params: ArgsDef,
	options: FlagsDef,
) {
	if (options.fleet) {
		for (const app of options.fleet.split(',')) {
			for (const service of options.service!.split(',')) {
				try {
					const serviceId = await getServiceIdForApp(sdk, app, service);
					await sdk.models.service.var.set(
						serviceId,
						params.name,
						params.value!,
					);
				} catch (err) {
					console.error(`${err.message}, fleet: ${app}`);
					process.exitCode = 1;
				}
			}
		}
	} else if (options.device) {
		const { getDeviceAndAppFromUUID } = await import('../../utils/cloud');
		for (const uuid of options.device.split(',')) {
			let device;
			let app;
			try {
				[device, app] = await getDeviceAndAppFromUUID(
					sdk,
					uuid,
					['id'],
					['slug'],
				);
			} catch (err) {
				console.error(`${err.message}, device: ${uuid}`);
				process.exitCode = 1;
				continue;
			}
			for (const service of options.service!.split(',')) {
				try {
					const serviceId = await getServiceIdForApp(sdk, app.slug, service);
					await sdk.models.device.serviceVar.set(
						device.id,
						serviceId,
						params.name,
						params.value!,
					);
				} catch (err) {
					console.error(`${err.message}, service: ${service}`);
					process.exitCode = 1;
				}
			}
		}
	}
}

/**
 * Return a sevice ID for the given app name and service name.
 */
async function getServiceIdForApp(
	sdk: BalenaSdk.BalenaSDK,
	appName: string,
	serviceName: string,
): Promise<number> {
	let serviceId: number | undefined;
	const services = await sdk.models.service.getAllByApplication(appName, {
		$filter: { service_name: serviceName },
	});
	if (services.length > 0) {
		serviceId = services[0].id;
	}
	if (serviceId === undefined) {
		throw new ExpectedError(
			`Cannot find service ${serviceName} for fleet ${appName}`,
		);
	}
	return serviceId;
}

/**
 * Return an array of variable name prefixes like: [ 'RESIN_', 'BALENA_' ].
 * These prefixes can be used to identify "configuration variables".
 */
async function getReservedPrefixes(
	balena: BalenaSdk.BalenaSDK,
): Promise<string[]> {
	const settings = await balena.settings.getAll();
	const response = await balena.request.send({
		baseUrl: settings.apiUrl,
		url: '/config/vars',
	});

	return response.body.reservedNamespaces;
}
