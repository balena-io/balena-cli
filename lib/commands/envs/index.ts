/**
 * @license
 * Copyright 2016-2021 Balena Ltd.
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
import { Flags } from '@oclif/core';
import type { Interfaces } from '@oclif/core';
import type * as SDK from 'balena-sdk';
import _ from 'lodash';
import Command from '../../command.js';
import { ExpectedError } from '../../errors.js';
import * as cf from '../../utils/common-flags.js';
import { getBalenaSdk, getVisuals, stripIndent } from '../../utils/lazy.js';
import { applicationIdInfo } from '../../utils/messages.js';

type FlagsDef = Interfaces.InferredFlags<typeof EnvsCmd.flags>;

interface EnvironmentVariableInfo extends SDK.EnvironmentVariableBase {
	fleet?: string | null; // fleet slug
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

interface DeviceServiceEnvironmentVariableInfo
	extends SDK.DeviceServiceEnvironmentVariable {
	fleet?: string; // fleet slug
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

interface ServiceEnvironmentVariableInfo
	extends SDK.ServiceEnvironmentVariable {
	fleet?: string; // fleet slug
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

export default class EnvsCmd extends Command {
	public static description = stripIndent`
		List the environment or config variables of a fleet, device or service.

		List the environment or configuration variables of a fleet, device or
		service, as selected by the respective command-line options. (A service
		corresponds to a Docker image/container in a microservices fleet.)

		The results include fleet-wide (multiple devices), device-specific (multiple
		services on a specific device) and service-specific variables that apply to the
		selected fleet, device or service. It can be thought of as including inherited
		variables; for example, a service inherits device-wide variables, and a device
		inherits fleet-wide variables.

		The printed output may include DEVICE and/or SERVICE columns to distinguish
		between fleet-wide, device-specific and service-specific variables.
		An asterisk in these columns indicates that the variable applies to
		"all devices" or "all services".

		The --config option is used to list "configuration variables" that control
		balena platform features, as opposed to custom environment variables defined
		by the user. The --config and the --service options are mutually exclusive
		because configuration variables cannot be set for specific services.

		The --json option is recommended when scripting the output of this command,
		because the JSON format is less likely to change and it better represents data
		types like lists and empty strings. The 'jq' utility may be helpful in shell
		scripts (https://stedolan.github.io/jq/manual/). When --json is used, an empty
		JSON array ([]) is printed instead of an error message when no variables exist
		for the given query. When querying variables for a device, note that the fleet
		name may be null in JSON output (or 'N/A' in tabular output) if the fleet that
		the device belonged to is no longer accessible by the current user (for example,
		in case the current user was removed from the fleet by the fleet's owner).

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena envs --fleet myorg/myfleet',
		'$ balena envs --fleet MyFleet --json',
		'$ balena envs --fleet MyFleet --service MyService',
		'$ balena envs --fleet MyFleet --config',
		'$ balena envs --device 7cf02a6',
		'$ balena envs --device 7cf02a6 --json',
		'$ balena envs --device 7cf02a6 --config --json',
		'$ balena envs --device 7cf02a6 --service MyService',
	];

	public static usage = 'envs';

	public static flags = {
		fleet: { ...cf.fleet, exclusive: ['device'] },
		config: Flags.boolean({
			default: false,
			char: 'c',
			description: 'show configuration variables only',
			exclusive: ['service'],
		}),
		device: { ...cf.device, exclusive: ['fleet'] },
		help: cf.help,
		json: cf.json,
		service: { ...cf.service, exclusive: ['config'] },
	};

	public async run() {
		const { flags: options } = await this.parse(EnvsCmd);

		const variables: EnvironmentVariableInfo[] = [];

		await Command.checkLoggedIn();

		if (!options.fleet && !options.device) {
			throw new ExpectedError('Missing --fleet or --device option');
		}

		const balena = getBalenaSdk();

		let fleetSlug: string | undefined = options.fleet
			? await (
					await import('../../utils/sdk.js')
				).getFleetSlug(balena, options.fleet)
			: undefined;
		let fullUUID: string | undefined; // as oppposed to the short, 7-char UUID

		if (options.device) {
			const { getDeviceAndMaybeAppFromUUID } = await import(
				'../../utils/cloud.js'
			);
			const [device, app] = await getDeviceAndMaybeAppFromUUID(
				balena,
				options.device,
				['uuid'],
				['slug'],
			);
			fullUUID = device.uuid;
			if (app) {
				fleetSlug = app.slug;
			}
		}
		if (fleetSlug && options.service) {
			await validateServiceName(balena, options.service, fleetSlug);
		}
		variables.push(...(await getAppVars(balena, fleetSlug, options)));
		if (fullUUID) {
			variables.push(
				...(await getDeviceVars(balena, fullUUID, fleetSlug, options)),
			);
		}
		if (!options.json && variables.length === 0) {
			const target =
				(options.service ? `service "${options.service}" of ` : '') +
				(options.fleet
					? `fleet "${options.fleet}"`
					: `device "${options.device}"`);
			throw new ExpectedError(`No environment variables found for ${target}`);
		}

		await this.printVariables(variables, options);
	}

	protected async printVariables(
		varArray: EnvironmentVariableInfo[],
		options: FlagsDef,
	) {
		const fields = ['id', 'name', 'value', 'fleet'];

		// Replace undefined app names with 'N/A' or null
		varArray = varArray.map((i: EnvironmentVariableInfo) => {
			i.fleet ||= options.json ? null : 'N/A';
			return i;
		});

		if (options.device) {
			fields.push(options.json ? 'deviceUUID' : 'deviceUUID => DEVICE');
		}
		if (!options.config) {
			fields.push(options.json ? 'serviceName' : 'serviceName => SERVICE');
		}

		if (options.json) {
			const { pickAndRename } = await import('../../utils/helpers.js');
			const mapped = varArray.map((o) => pickAndRename(o, fields));
			this.log(JSON.stringify(mapped, null, 4));
		} else {
			this.log(
				getVisuals().table.horizontal(
					_.sortBy(varArray, (v: SDK.EnvironmentVariableBase) => v.name),
					fields,
				),
			);
		}
	}
}

async function validateServiceName(
	sdk: SDK.BalenaSDK,
	serviceName: string,
	fleetSlug: string,
) {
	const services = await sdk.models.service.getAllByApplication(fleetSlug, {
		$select: 'id',
		$filter: { service_name: serviceName },
	});
	if (services.length === 0) {
		throw new ExpectedError(
			`Service "${serviceName}" not found for fleet "${fleetSlug}"`,
		);
	}
}

/**
 * Fetch application-wide config / env / service vars.
 * If options.application is undefined, an attempt is made to obtain the
 * application name from the device UUID (options.device). If this attempt
 * fails because the device does not belong to any application, an emtpy
 * array is returned.
 */
async function getAppVars(
	sdk: SDK.BalenaSDK,
	fleetSlug: string | undefined,
	options: FlagsDef,
): Promise<EnvironmentVariableInfo[]> {
	const appVars: EnvironmentVariableInfo[] = [];
	if (!fleetSlug) {
		return appVars;
	}
	const vars =
		await sdk.models.application[
			options.config ? 'configVar' : 'envVar'
		].getAllByApplication(fleetSlug);
	fillInInfoFields(vars, fleetSlug);
	appVars.push(...vars);
	if (!options.config) {
		const pineOpts: SDK.PineOptions<SDK.ServiceEnvironmentVariable> = {
			$expand: {
				service: {},
			},
		};
		if (options.service) {
			pineOpts.$filter = {
				service: {
					service_name: options.service,
				},
			};
		}
		const serviceVars = await sdk.models.service.var.getAllByApplication(
			fleetSlug,
			pineOpts,
		);
		fillInInfoFields(serviceVars, fleetSlug);
		appVars.push(...serviceVars);
	}
	return appVars;
}

/**
 * Fetch config / env / service vars when the '--device' option is provided.
 * Precondition: options.device must be defined.
 */
async function getDeviceVars(
	sdk: SDK.BalenaSDK,
	fullUUID: string,
	fleetSlug: string | undefined,
	options: FlagsDef,
): Promise<EnvironmentVariableInfo[]> {
	const printedUUID = options.json ? fullUUID : options.device!;
	const deviceVars: EnvironmentVariableInfo[] = [];
	if (options.config) {
		const deviceConfigVars =
			await sdk.models.device.configVar.getAllByDevice(fullUUID);
		fillInInfoFields(deviceConfigVars, fleetSlug, printedUUID);
		deviceVars.push(...deviceConfigVars);
	} else {
		const pineOpts: SDK.PineOptions<SDK.DeviceServiceEnvironmentVariable> = {
			$expand: {
				service_install: {
					$expand: 'installs__service',
				},
			},
		};
		if (options.service) {
			pineOpts.$filter = {
				service_install: {
					installs__service: { service_name: options.service },
				},
			};
		}
		const deviceServiceVars = await sdk.models.device.serviceVar.getAllByDevice(
			fullUUID,
			pineOpts,
		);
		fillInInfoFields(deviceServiceVars, fleetSlug, printedUUID);
		deviceVars.push(...deviceServiceVars);

		const deviceEnvVars =
			await sdk.models.device.envVar.getAllByDevice(fullUUID);
		fillInInfoFields(deviceEnvVars, fleetSlug, printedUUID);
		deviceVars.push(...deviceEnvVars);
	}
	return deviceVars;
}

/**
 * For each env var object in varArray, fill in its top-level serviceName
 * and deviceUUID fields. An asterisk is used to indicate that the variable
 * applies to "all services" or "all devices".
 */
function fillInInfoFields(
	varArray:
		| EnvironmentVariableInfo[]
		| DeviceServiceEnvironmentVariableInfo[]
		| ServiceEnvironmentVariableInfo[],
	fleetSlug?: string,
	deviceUUID?: string,
) {
	for (const envVar of varArray) {
		if ('service' in envVar) {
			// envVar is of type ServiceEnvironmentVariableInfo
			envVar.serviceName = (envVar.service as SDK.Service[])[0]?.service_name;
		} else if ('service_install' in envVar) {
			// envVar is of type DeviceServiceEnvironmentVariableInfo
			envVar.serviceName = (
				(envVar.service_install as SDK.ServiceInstall[])[0]
					?.installs__service as SDK.Service[]
			)[0]?.service_name;
		}
		envVar.fleet = fleetSlug;
		envVar.serviceName = envVar.serviceName || '*';
		envVar.deviceUUID = deviceUUID || '*';
	}
}
