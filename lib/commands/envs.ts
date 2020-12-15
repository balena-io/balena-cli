/**
 * @license
 * Copyright 2016-2019 Balena Ltd.
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
import type * as SDK from 'balena-sdk';
import * as _ from 'lodash';
import Command from '../command';
import { ExpectedError } from '../errors';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, getVisuals, stripIndent } from '../utils/lazy';
import { applicationIdInfo } from '../utils/messages';
import { isV13 } from '../utils/version';

interface FlagsDef {
	application?: string;
	config: boolean;
	device?: string; // device UUID
	json: boolean;
	help: void;
	service?: string; // service name
	verbose: boolean;
}

interface EnvironmentVariableInfo extends SDK.EnvironmentVariableBase {
	appName?: string | null; // application name
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

interface DeviceServiceEnvironmentVariableInfo
	extends SDK.DeviceServiceEnvironmentVariable {
	appName?: string; // application name
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

interface ServiceEnvironmentVariableInfo
	extends SDK.ServiceEnvironmentVariable {
	appName?: string; // application name
	deviceUUID?: string; // device UUID
	serviceName?: string; // service name
}

export default class EnvsCmd extends Command {
	public static description = stripIndent`
		List the environment or config variables of an application, device or service.

		List the environment or configuration variables of an application, device or
		service, as selected by the respective command-line options. (A service is
		an application container in a "microservices" application.)

		The results include application-wide (fleet), device-wide (multiple services on
		a device) and service-specific variables that apply to the selected application,
		device or service. It can be thought of as including "inherited" variables;
		for example, a service inherits device-wide variables, and a device inherits
		application-wide variables.

		The printed output may include DEVICE and/or SERVICE columns to distinguish
		between application-wide, device-specific and service-specific variables.
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
		for the given query. When querying variables for a device, note that the
		application name may be null in JSON output (or 'N/A' in tabular output) if the
		application linked to the device is no longer accessible by the current user
		(for example, in case the current user has been removed from the application
		by its owner).

		${applicationIdInfo.split('\n').join('\n\t\t')}
	`;

	public static examples = [
		'$ balena envs --application MyApp',
		'$ balena envs --application myorg/myapp',
		'$ balena envs --application MyApp --json',
		'$ balena envs --application MyApp --service MyService',
		'$ balena envs --application MyApp --service MyService',
		'$ balena envs --application MyApp --config',
		'$ balena envs --device 7cf02a6',
		'$ balena envs --device 7cf02a6 --json',
		'$ balena envs --device 7cf02a6 --config --json',
		'$ balena envs --device 7cf02a6 --service MyService',
	];

	public static usage = 'envs';

	public static flags: flags.Input<FlagsDef> = {
		...(isV13()
			? {}
			: {
					all: flags.boolean({
						default: false,
						description: stripIndent`
				No-op since balena CLI v12.0.0.`,
						hidden: true,
					}),
			  }),

		application: { exclusive: ['device'], ...cf.application },
		config: flags.boolean({
			default: false,
			char: 'c',
			description: 'show configuration variables only',
			exclusive: ['service'],
		}),
		device: { exclusive: ['application'], ...cf.device },
		help: cf.help,
		json: cf.json,
		verbose: cf.verbose,
		service: { exclusive: ['config'], ...cf.service },
	};

	public async run() {
		const { flags: options } = this.parse<FlagsDef, {}>(EnvsCmd);
		const variables: EnvironmentVariableInfo[] = [];

		await Command.checkLoggedIn();

		if (!options.application && !options.device) {
			throw new ExpectedError('You must specify an application or device');
		}

		const balena = getBalenaSdk();

		let appNameOrSlug = options.application;
		let fullUUID: string | undefined; // as oppposed to the short, 7-char UUID

		if (options.device) {
			const { getDeviceAndMaybeAppFromUUID } = await import('../utils/cloud');
			const [device, app] = await getDeviceAndMaybeAppFromUUID(
				balena,
				options.device,
				['uuid'],
				['app_name'],
			);
			fullUUID = device.uuid;
			if (app) {
				appNameOrSlug = app.app_name;
			}
		}
		if (appNameOrSlug && options.service) {
			await validateServiceName(balena, options.service, appNameOrSlug);
		}
		variables.push(...(await getAppVars(balena, appNameOrSlug, options)));
		if (fullUUID) {
			variables.push(
				...(await getDeviceVars(balena, fullUUID, appNameOrSlug, options)),
			);
		}
		if (!options.json && variables.length === 0) {
			const target =
				(options.service ? `service "${options.service}" of ` : '') +
				(options.application
					? `application "${options.application}"`
					: `device "${options.device}"`);
			throw new ExpectedError(`No environment variables found for ${target}`);
		}

		await this.printVariables(variables, options);
	}

	protected async printVariables(
		varArray: EnvironmentVariableInfo[],
		options: FlagsDef,
	) {
		const fields = ['id', 'name', 'value'];

		// Replace undefined app names with 'N/A' or null
		varArray = varArray.map((i: EnvironmentVariableInfo) => {
			i.appName = i.appName || (options.json ? null : 'N/A');
			return i;
		});

		fields.push(options.json ? 'appName' : 'appName => APPLICATION');
		if (options.device) {
			fields.push(options.json ? 'deviceUUID' : 'deviceUUID => DEVICE');
		}
		if (!options.config) {
			fields.push(options.json ? 'serviceName' : 'serviceName => SERVICE');
		}

		if (options.json) {
			this.log(
				stringifyVarArray<SDK.EnvironmentVariableBase>(varArray, fields),
			);
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
	appName: string,
) {
	const services = await sdk.models.service.getAllByApplication(appName, {
		$filter: { service_name: serviceName },
	});
	if (services.length === 0) {
		throw new ExpectedError(
			`Service "${serviceName}" not found for application "${appName}"`,
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
	appNameOrSlug: string | undefined,
	options: FlagsDef,
): Promise<EnvironmentVariableInfo[]> {
	const appVars: EnvironmentVariableInfo[] = [];
	if (!appNameOrSlug) {
		return appVars;
	}
	const vars = await sdk.models.application[
		options.config ? 'configVar' : 'envVar'
	].getAllByApplication(appNameOrSlug);
	fillInInfoFields(vars, appNameOrSlug);
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
			appNameOrSlug,
			pineOpts,
		);
		fillInInfoFields(serviceVars, appNameOrSlug);
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
	appNameOrSlug: string | undefined,
	options: FlagsDef,
): Promise<EnvironmentVariableInfo[]> {
	const printedUUID = options.json ? fullUUID : options.device!;
	const deviceVars: EnvironmentVariableInfo[] = [];
	if (options.config) {
		const deviceConfigVars = await sdk.models.device.configVar.getAllByDevice(
			fullUUID,
		);
		fillInInfoFields(deviceConfigVars, appNameOrSlug, printedUUID);
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
		fillInInfoFields(deviceServiceVars, appNameOrSlug, printedUUID);
		deviceVars.push(...deviceServiceVars);

		const deviceEnvVars = await sdk.models.device.envVar.getAllByDevice(
			fullUUID,
		);
		fillInInfoFields(deviceEnvVars, appNameOrSlug, printedUUID);
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
	appNameOrSlug?: string,
	deviceUUID?: string,
) {
	for (const envVar of varArray) {
		if ('service' in envVar) {
			// envVar is of type ServiceEnvironmentVariableInfo
			envVar.serviceName = (envVar.service as SDK.Service[])[0]?.service_name;
		} else if ('service_install' in envVar) {
			// envVar is of type DeviceServiceEnvironmentVariableInfo
			envVar.serviceName = ((envVar.service_install as SDK.ServiceInstall[])[0]
				?.installs__service as SDK.Service[])[0]?.service_name;
		}
		envVar.appName = appNameOrSlug;
		envVar.serviceName = envVar.serviceName || '*';
		envVar.deviceUUID = deviceUUID || '*';
	}
}

/**
 * Transform each object (item) of varArray to preserve only the
 * fields (keys) listed in the fields argument.
 */
function stringifyVarArray<T = Dictionary<any>>(
	varArray: T[],
	fields: string[],
): string {
	const transformed = varArray.map((o: Dictionary<any>) =>
		_.transform(
			o,
			(result, value, key) => {
				if (fields.includes(key)) {
					result[key] = value;
				}
			},
			{} as Dictionary<any>,
		),
	);
	return JSON.stringify(transformed, null, 4);
}
