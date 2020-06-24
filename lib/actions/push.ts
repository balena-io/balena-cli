/*
Copyright 2016-2020 Balena Ltd.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import type { BalenaSDK } from 'balena-sdk';
import type { CommandDefinition } from 'capitano';

import { ExpectedError } from '../errors';
import { getBalenaSdk, stripIndent } from '../utils/lazy';
import { dockerignoreHelp, registrySecretsHelp } from '../utils/messages';
import {
	validateApplicationName,
	validateDotLocalUrl,
	validateIPAddress,
} from '../utils/validation';
import { isV12 } from '../utils/version';

enum BuildTarget {
	Cloud,
	Device,
}

function getBuildTarget(appOrDevice: string): BuildTarget | null {
	// First try the application regex from the api
	if (validateApplicationName(appOrDevice)) {
		return BuildTarget.Cloud;
	}

	if (validateIPAddress(appOrDevice) || validateDotLocalUrl(appOrDevice)) {
		return BuildTarget.Device;
	}

	return null;
}

async function getAppOwner(sdk: BalenaSDK, appName: string) {
	const { selectFromList } = await import('../utils/patterns');
	const _ = await import('lodash');

	const applications = await sdk.models.application.getAll({
		$expand: {
			user: {
				$select: ['username'],
			},
		},
		$filter: {
			$eq: [{ $tolower: { $: 'app_name' } }, appName.toLowerCase()],
		},
		$select: ['id'],
	});

	if (applications == null || applications.length === 0) {
		throw new ExpectedError(
			stripIndent`
			No applications found with name: ${appName}.

			This could mean that the application does not exist, or you do
			not have the permissions required to access it.`,
		);
	}

	if (applications.length === 1) {
		return _.get(applications, '[0].user[0].username');
	}

	// If we got more than one application with the same name it means that the
	// user has access to a collab app with the same name as a personal app. We
	// present a list to the user which shows the fully qualified application
	// name (user/appname) and allows them to select
	const entries = _.map(applications, (app) => {
		const username = _.get(app, 'user[0].username');
		return {
			name: `${username}/${appName}`,
			extra: username,
		};
	});

	const selected = await selectFromList(
		`${entries.length} applications found with that name, please select the application you would like to push to`,
		entries,
	);

	return selected.extra;
}

export const push: CommandDefinition<
	{
		// when Capitano converts a positional parameter (but not an option)
		// to a number, the original value is preserved with the _raw suffix
		applicationOrDevice: string;
		applicationOrDevice_raw: string;
	},
	{
		source?: string;
		emulated?: boolean;
		dockerfile?: string; // DeviceDeployOptions.dockerfilePath (alternative Dockerfile)
		nocache?: boolean;
		'noparent-check'?: boolean;
		'registry-secrets'?: string;
		gitignore?: boolean;
		nogitignore?: boolean;
		nolive?: boolean;
		detached?: boolean;
		service?: string | string[];
		system?: boolean;
		env?: string | string[];
		'convert-eol'?: boolean;
		'noconvert-eol'?: boolean;
		'multi-dockerignore'?: boolean;
	}
> = {
	signature: 'push <applicationOrDevice>',
	primary: true,
	description:
		'Start a remote build on the balena cloud build servers or a local mode device',
	help: stripIndent`
		This command can be used to start a build on the remote balena cloud builders,
		or a local mode balena device.

		When building on the balenaCloud servers, the given source directory will be
		sent to the remote server. This can be used as a drop-in replacement for the
		"git push" deployment method.

		When building on a local mode device, the given source directory will be
		built on the device, and the resulting containers will be run on the device.
		Logs will be streamed back from the device as part of the same invocation.
		The web dashboard can be used to switch a device to local mode:
		https://www.balena.io/docs/learn/develop/local-mode/
		Note that local mode requires a supervisor version of at least v7.21.0.
		The logs from only a single service can be shown with the --service flag, and
		showing only the system logs can be achieved with --system. Note that these
		flags can be used together.

		When pushing to a local device a live session will be started.
		The project source folder is watched for filesystem events, and changes
		to files and folders are automatically synchronized to the running
		containers. The synchronization is only in one direction, from this machine to
		the device, and changes made on the device itself may be overwritten.
		This feature requires a device running supervisor version v9.7.0 or greater.

		${registrySecretsHelp.split('\n').join('\n\t\t')}

		${dockerignoreHelp.split('\n').join('\n\t\t')}

		Examples:

			$ balena push myApp
			$ balena push myApp --source <source directory>
			$ balena push myApp -s <source directory>

			$ balena push 10.0.0.1
			$ balena push 10.0.0.1 --source <source directory>
			$ balena push 10.0.0.1 --service my-service
			$ balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value
			$ balena push 10.0.0.1 --nolive

			$ balena push 23c73a1.local --system
			$ balena push 23c73a1.local --system --service my-service
	`,
	options: [
		{
			signature: 'source',
			alias: 's',
			description:
				'Source directory to be sent to balenaCloud or balenaOS device (default: current working dir)',
			parameter: 'source',
		},
		{
			signature: 'emulated',
			alias: 'e',
			description: 'Force an emulated build to occur on the remote builder',
			boolean: true,
		},
		{
			signature: 'dockerfile',
			parameter: 'Dockerfile',
			description:
				'Alternative Dockerfile name/path, relative to the source folder',
		},
		{
			signature: 'nocache',
			alias: 'c',
			description: "Don't use cache when building this project",
			boolean: true,
		},
		{
			signature: 'noparent-check',
			description:
				"Disable project validation check of 'docker-compose.yml' file in parent folder",
			boolean: true,
		},
		{
			signature: 'registry-secrets',
			alias: 'R',
			parameter: 'secrets.yml|.json',
			description: stripIndent`
				Path to a local YAML or JSON file containing Docker registry passwords used to pull base images.
				Note that if registry-secrets are not provided on the command line, a secrets configuration
				file from the balena directory will be used (usually $HOME/.balena/secrets.yml|.json)`,
		},
		{
			signature: 'nolive',
			boolean: true,
			description: stripIndent`
				Don't run a live session on this push. The filesystem will not be monitored, and changes
				will not be synchronized to any running containers. Note that both this flag and --detached
				and required to cause the process to end once the initial build has completed.`,
		},
		{
			signature: 'detached',
			alias: 'd',
			description: stripIndent`
				When pushing to the cloud, this option will cause the build to start, then return execution
				back to the shell, with the status and release ID (if applicable).

				When pushing to a local mode device, this option will cause the command to not tail application logs when the build
				has completed.`,
			boolean: true,
		},
		{
			signature: 'service',
			description: stripIndent`
				Reject logs not originating from this service.
				This can be used in combination with --system and other --service flags.
				Only valid when pushing to a local mode device.`,
			parameter: 'service',
		},
		{
			signature: 'system',
			description: stripIndent`
				Only show system logs. This can be used in combination with --service.
				Only valid when pushing to a local mode device.`,
			boolean: true,
		},
		{
			signature: 'env',
			parameter: 'env',
			description: stripIndent`
				When performing a push to device, run the built containers with environment
				variables provided with this argument. Environment variables can be applied
				to individual services by adding their service name before the argument,
				separated by a colon, e.g:
					--env main:MY_ENV=value
				Note that if the service name cannot be found in the composition, the entire
				left hand side of the = character will be treated as the variable name.
			`,
		},
		{
			signature: 'convert-eol',
			alias: 'l',
			description: isV12()
				? 'No-op and deprecated since balena CLI v12.0.0'
				: stripIndent`
				On Windows only, convert line endings from CRLF (Windows format) to LF (Unix format).
				Source files are not modified.`,
			boolean: true,
		},
		...(isV12()
			? [
					{
						signature: 'noconvert-eol',
						description:
							"Don't convert line endings from CRLF (Windows format) to LF (Unix format).",
						boolean: true,
					},
			  ]
			: []),
		{
			signature: 'multi-dockerignore',
			alias: 'm',
			description:
				'Have each service use its own .dockerignore file. See "balena help push".',
			boolean: true,
		},
		{
			signature: 'nogitignore',
			alias: 'G',
			description:
				'No-op (default behavior) since balena CLI v12.0.0. See "balena help push".',
			boolean: true,
		},
		{
			signature: 'gitignore',
			alias: 'g',
			description: stripIndent`
				Consider .gitignore files in addition to the .dockerignore file. This reverts
				to the CLI v11 behavior/implementation (deprecated) if compatibility is required
				until your project can be adapted.`,
			boolean: true,
		},
	],
	async action(params, options) {
		const sdk = getBalenaSdk();
		const Bluebird = await import('bluebird');
		const remote = await import('../utils/remote-build');
		const deviceDeploy = await import('../utils/device/deploy');
		const { checkLoggedIn } = await import('../utils/patterns');
		const { validateProjectDirectory } = await import('../utils/compose_ts');
		const { BuildError } = await import('../utils/device/errors');

		const appOrDevice: string | null =
			params.applicationOrDevice_raw || params.applicationOrDevice;
		if (appOrDevice == null) {
			throw new ExpectedError('You must specify an application or a device');
		}
		if (options.gitignore && options['multi-dockerignore']) {
			throw new ExpectedError(
				'The --gitignore and --multi-dockerignore options cannot be used together',
			);
		}

		const source = options.source || '.';
		if (process.env.DEBUG) {
			console.error(`[debug] Using ${source} as build source`);
		}

		const { dockerfilePath, registrySecrets } = await validateProjectDirectory(
			sdk,
			{
				dockerfilePath: options.dockerfile,
				noParentCheck: options['noparent-check'] || false,
				projectPath: source,
				registrySecretsPath: options['registry-secrets'],
			},
		);

		const nogitignore = !options.gitignore;
		const convertEol = isV12()
			? !options['noconvert-eol']
			: !!options['convert-eol'];

		const buildTarget = getBuildTarget(appOrDevice);
		switch (buildTarget) {
			case BuildTarget.Cloud:
				// Ensure that the live argument has not been passed to a cloud build
				if (options.nolive != null) {
					throw new ExpectedError(
						'The --nolive flag is only valid when pushing to a local mode device',
					);
				}
				if (options.service) {
					throw new ExpectedError(
						'The --service flag is only valid when pushing to a local mode device.',
					);
				}
				if (options.system) {
					throw new ExpectedError(
						'The --system flag is only valid when pushing to a local mode device.',
					);
				}
				if (options.env) {
					throw new ExpectedError(
						'The --env flag is only valid when pushing to a local mode device.',
					);
				}

				const app = appOrDevice;
				await checkLoggedIn();
				await Bluebird.join(
					sdk.auth.getToken(),
					sdk.settings.get('balenaUrl'),
					getAppOwner(sdk, app),
					async (token, baseUrl, owner) => {
						const opts = {
							dockerfilePath,
							emulated: options.emulated || false,
							multiDockerignore: options['multi-dockerignore'] || false,
							nocache: options.nocache || false,
							registrySecrets,
							headless: options.detached || false,
							convertEol,
						};
						const args = {
							app,
							owner,
							source,
							auth: token,
							baseUrl,
							nogitignore,
							sdk,
							opts,
						};
						return await remote.startRemoteBuild(args);
					},
				);
				break;
			case BuildTarget.Device:
				const device = appOrDevice;
				const servicesToDisplay =
					options.service != null
						? Array.isArray(options.service)
							? options.service
							: [options.service]
						: undefined;
				// TODO: Support passing a different port
				await Bluebird.resolve(
					deviceDeploy.deployToDevice({
						source,
						deviceHost: device,
						dockerfilePath,
						registrySecrets,
						multiDockerignore: options['multi-dockerignore'] || false,
						nocache: options.nocache || false,
						nogitignore,
						noParentCheck: options['noparent-check'] || false,
						nolive: options.nolive || false,
						detached: options.detached || false,
						services: servicesToDisplay,
						system: options.system || false,
						env:
							typeof options.env === 'string'
								? [options.env]
								: options.env || [],
						convertEol,
					}),
				).catch(BuildError, (e) => {
					throw new ExpectedError(e.toString());
				});
				break;
			default:
				throw new ExpectedError(
					stripIndent`
					Build target not recognized. Please provide either an application name or device address.

					The only supported device addresses currently are IP addresses.

					If you believe your build target should have been detected, and this is an error, please
					create an issue.`,
				);
		}
	},
};
