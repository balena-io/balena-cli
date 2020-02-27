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

import { Command, flags } from '@oclif/command';
import * as BalenaSdk from 'balena-sdk';
import { stripIndent } from 'common-tags';
import * as _ from 'lodash';

import { ExpectedError } from '../../errors';
import * as cf from '../../utils/common-flags';
import { getBalenaSdk } from '../../utils/lazy';
import { CommandHelp } from '../../utils/oclif-utils';

interface FlagsDef {
	application?: string; // application name
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
		Add an environment or config variable to an application, device or service.

		Add an environment or config variable to an application, device or service,
		as selected by the respective command-line options. Either the --application
		or the --device option must be provided, and either may be be used alongside
		the --service option to define a service-specific variable. (A service is an
		application container in a "microservices" application.) When the --service
		option is used in conjunction with the --device option, the service variable
		applies to the selected device only. Otherwise, it applies to all devices of
		the selected application (i.e., the application's fleet). If the --service
		option is omitted, the variable applies to all services.

		If VALUE is omitted, the CLI will attempt to use the value of the environment
		variable of same name in the CLI process' environment. In this case, a warning
		message will be printed. Use \`--quiet\` to suppress it.

		'BALENA_' or 'RESIN_' are reserved variable name prefixes used to identify
		"configuration variables". Configuration variables control balena platform
		features and are treated specially by balenaOS and the balena supervisor
		running on devices. They are also stored differently in the balenaCloud API
		database. Configuration variables cannot be set for specific services,
		therefore the --service option cannot be used when the variable name starts
		with a reserved prefix. When defining custom application variables, please
		avoid the reserved prefixes.
`;
	public static examples = [
		'$ balena env add TERM --application MyApp',
		'$ balena env add EDITOR vim --application MyApp',
		'$ balena env add EDITOR vim --application MyApp --service MyService',
		'$ balena env add EDITOR vim --device 7cf02a6',
		'$ balena env add EDITOR vim --device 7cf02a6 --service MyService',
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

	// hardcoded 'env add' to avoid oclif's 'env:add' topic syntax
	public static usage =
		'env add ' + new CommandHelp({ args: EnvAddCmd.args }).defaultUsage();

	public static flags: flags.Input<FlagsDef> = {
		application: _.assign({ exclusive: ['device'] }, cf.application),
		device: _.assign({ exclusive: ['application'] }, cf.device),
		help: cf.help,
		quiet: cf.quiet,
		service: cf.service,
	};

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			EnvAddCmd,
		);
		const cmd = this;
		const { checkLoggedIn } = await import('../../utils/patterns');

		if (!options.application && !options.device) {
			throw new ExpectedError(
				'Either the --application or the --device option must always be used',
			);
		}

		await checkLoggedIn();

		if (params.value == null) {
			params.value = process.env[params.name];

			if (params.value == null) {
				throw new Error(
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
		const isConfigVar = _.some(reservedPrefixes, prefix =>
			_.startsWith(params.name, prefix),
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
		if (options.application) {
			await balena.models.application[varType].set(
				options.application,
				params.name,
				params.value,
			);
		} else if (options.device) {
			await balena.models.device[varType].set(
				options.device,
				params.name,
				params.value,
			);
		}
	}
}

/**
 * Add service variables for a device or application.
 */
async function setServiceVars(
	sdk: BalenaSdk.BalenaSDK,
	params: ArgsDef,
	options: FlagsDef,
) {
	if (options.application) {
		const serviceId = await getServiceIdForApp(
			sdk,
			options.application,
			options.service!,
		);
		await sdk.models.service.var.set(serviceId, params.name, params.value!);
	} else {
		const { getDeviceAndAppFromUUID } = await import('../../utils/cloud');
		const [device, app] = await getDeviceAndAppFromUUID(
			sdk,
			options.device!,
			['id'],
			['app_name'],
		);
		const serviceId = await getServiceIdForApp(
			sdk,
			app.app_name,
			options.service!,
		);
		await sdk.models.device.serviceVar.set(
			device.id,
			serviceId,
			params.name,
			params.value!,
		);
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
	if (!_.isEmpty(services)) {
		serviceId = services[0].id;
	}
	if (serviceId === undefined) {
		throw new ExpectedError(
			`Cannot find service ${serviceName} for application ${appName}`,
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
