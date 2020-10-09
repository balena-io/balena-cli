/**
 * @license
 * Copyright 2016-2020 Balena Ltd.
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
import Command from '../command';
import * as cf from '../utils/common-flags';
import { getBalenaSdk, stripIndent } from '../utils/lazy';
import { dockerignoreHelp, registrySecretsHelp } from '../utils/messages';
import type { BalenaSDK, Application, Organization } from 'balena-sdk';
import { ExpectedError, instanceOf } from '../errors';

enum BuildTarget {
	Cloud,
	Device,
}

interface FlagsDef {
	source?: string;
	emulated: boolean;
	dockerfile?: string; // DeviceDeployOptions.dockerfilePath (alternative Dockerfile)
	nocache?: boolean;
	pull?: boolean;
	'noparent-check'?: boolean;
	'registry-secrets'?: string;
	gitignore?: boolean;
	nogitignore?: boolean;
	nolive?: boolean;
	detached?: boolean;
	service?: string[];
	system?: boolean;
	env?: string[];
	'convert-eol'?: boolean;
	'noconvert-eol'?: boolean;
	'multi-dockerignore'?: boolean;
	help: void;
}

interface ArgsDef {
	applicationOrDevice: string;
}

export default class PushCmd extends Command {
	public static description = stripIndent`
		Start a remote build on the balenaCloud build servers or a local mode device.

		Start a build on the remote balenaCloud builders, or a local mode balena device.

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

		Note: the --service and --env flags must come after the applicationOrDevice
		parameter, as per examples.
	`;

	public static examples = [
		'$ balena push myApp',
		'$ balena push myApp --source <source directory>',
		'$ balena push myApp -s <source directory>',
		'',
		'$ balena push 10.0.0.1',
		'$ balena push 10.0.0.1 --source <source directory>',
		'$ balena push 10.0.0.1 --service my-service',
		'$ balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value',
		'$ balena push 10.0.0.1 --nolive',
		'',
		'$ balena push 23c73a1.local --system',
		'$ balena push 23c73a1.local --system --service my-service',
	];

	public static args = [
		{
			name: 'applicationOrDevice',
			description: 'application name, or device address (for local pushes)',
			required: true,
		},
	];

	public static flags: flags.Input<FlagsDef> = {
		source: flags.string({
			description: stripIndent`
				Source directory to be sent to balenaCloud or balenaOS device
				(default: current working dir)`,
			char: 's',
		}),
		emulated: flags.boolean({
			description: stripIndent`
				Don't use native ARM servers; force QEMU ARM emulation on Intel x86-64
				servers during the image build (balenaCloud).`,
			char: 'e',
		}),
		dockerfile: flags.string({
			description:
				'Alternative Dockerfile name/path, relative to the source folder',
		}),
		nocache: flags.boolean({
			description: stripIndent`
				Don't use cached layers of previously built images for this project. This
				ensures that the latest base image and packages are pulled. Note that build
				logs may still display the message _"Pulling previous images for caching
				purposes" (as the cloud builder needs previous images to compute delta
				updates), but the logs will not display the "Using cache" lines for each
				build step of a Dockerfile.`,
			char: 'c',
		}),
		pull: flags.boolean({
			description: stripIndent`
				When pushing to a local device, force the base images to be pulled again.
				Currently this option is ignored when pushing to the balenaCloud builders.`,
		}),
		'noparent-check': flags.boolean({
			description: stripIndent`
				Disable project validation check of 'docker-compose.yml' file in parent folder`,
		}),
		'registry-secrets': flags.string({
			description: stripIndent`
				Path to a local YAML or JSON file containing Docker registry passwords used
				to pull base images. Note that if registry-secrets are not provided on the
				command line, a secrets configuration file from the balena directory will be
				used (usually $HOME/.balena/secrets.yml|.json)`,
			char: 'R',
		}),
		nolive: flags.boolean({
			description: stripIndent`
				Don't run a live session on this push. The filesystem will not be monitored,
				and changes will not be synchronized to any running containers. Note that both
				this flag and --detached and required to cause the process to end once the
				initial build has completed.`,
		}),
		detached: flags.boolean({
			description: stripIndent`
				When pushing to the cloud, this option will cause the build to start, then
				return execution back to the shell, with the status and release ID (if
				applicable).  When pushing to a local mode device, this option will cause
				the command to not tail application logs when the build has completed.`,
			char: 'd',
		}),
		service: flags.string({
			description: stripIndent`
				Reject logs not originating from this service.
				This can be used in combination with --system and other --service flags.
				Only valid when pushing to a local mode device.`,
			multiple: true,
		}),
		system: flags.boolean({
			description: stripIndent`
				Only show system logs. This can be used in combination with --service.
				Only valid when pushing to a local mode device.`,
		}),
		env: flags.string({
			description: stripIndent`
				When performing a push to device, run the built containers with environment
				variables provided with this argument. Environment variables can be applied
				to individual services by adding their service name before the argument,
				separated by a colon, e.g:
					--env main:MY_ENV=value
				Note that if the service name cannot be found in the composition, the entire
				left hand side of the = character will be treated as the variable name.
			`,
			multiple: true,
		}),
		'convert-eol': flags.boolean({
			description: 'No-op and deprecated since balenaCLI v12.0.0',
			char: 'l',
			hidden: true,
		}),
		'noconvert-eol': flags.boolean({
			description: `Don't convert line endings from CRLF (Windows format) to LF (Unix format).`,
		}),
		'multi-dockerignore': flags.boolean({
			description:
				'Have each service use its own .dockerignore file. See "balena help push".',
			char: 'm',
			exclusive: ['gitignore'],
		}),
		nogitignore: flags.boolean({
			description:
				'No-op (default behavior) since balenaCLI v12.0.0. See "balena help push".',
			char: 'G',
			hidden: true,
		}),
		gitignore: flags.boolean({
			description: stripIndent`
				Consider .gitignore files in addition to the .dockerignore file. This reverts
				to the CLI v11 behavior/implementation (deprecated) if compatibility is
				required until your project can be adapted.`,
			char: 'g',
			exclusive: ['multi-dockerignore'],
		}),
		help: cf.help,
	};

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			PushCmd,
		);

		const sdk = getBalenaSdk();
		const { validateProjectDirectory } = await import('../utils/compose_ts');

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
		const convertEol = !options['noconvert-eol'];

		const appOrDevice = params.applicationOrDevice;
		const buildTarget = await this.getBuildTarget(appOrDevice);
		switch (buildTarget) {
			case BuildTarget.Cloud:
				const remote = await import('../utils/remote-build');

				// Check for invalid options
				const localOnlyOptions = ['nolive', 'service', 'system', 'env'];

				localOnlyOptions.forEach((opt) => {
					// @ts-ignore : Not sure why typescript wont let me do this?
					if (options[opt]) {
						throw new ExpectedError(
							`The --${opt} flag is only valid when pushing to a local mode device`,
						);
					}
				});

				const app = appOrDevice;
				await Command.checkLoggedIn();
				const [token, baseUrl, owner] = await Promise.all([
					sdk.auth.getToken(),
					sdk.settings.get('balenaUrl'),
					this.getAppOwner(sdk, app),
				]);

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
				await remote.startRemoteBuild(args);
				break;

			case BuildTarget.Device:
				const deviceDeploy = await import('../utils/device/deploy');
				const device = appOrDevice;
				const servicesToDisplay = options.service;

				// TODO: Support passing a different port
				try {
					await deviceDeploy.deployToDevice({
						source,
						deviceHost: device,
						dockerfilePath,
						registrySecrets,
						multiDockerignore: options['multi-dockerignore'] || false,
						nocache: options.nocache || false,
						pull: options.pull || false,
						nogitignore,
						noParentCheck: options['noparent-check'] || false,
						nolive: options.nolive || false,
						detached: options.detached || false,
						services: servicesToDisplay,
						system: options.system || false,
						env: options.env || [],
						convertEol,
					});
				} catch (e) {
					const { BuildError } = await import('../utils/device/errors');
					if (instanceOf(e, BuildError)) {
						throw new ExpectedError(e.toString());
					} else {
						throw e;
					}
				}
				break;

			default:
				throw new ExpectedError(stripIndent`
					Build target not recognized. Please provide either an application name or
					device IP address.`);
		}
	}

	async getBuildTarget(appOrDevice: string): Promise<BuildTarget | null> {
		const {
			validateApplicationName,
			validateDotLocalUrl,
			validateIPAddress,
		} = await import('../utils/validation');

		// First try the application regex from the api
		if (validateApplicationName(appOrDevice)) {
			return BuildTarget.Cloud;
		}

		if (validateIPAddress(appOrDevice) || validateDotLocalUrl(appOrDevice)) {
			return BuildTarget.Device;
		}

		return null;
	}

	async getAppOwner(sdk: BalenaSDK, appName: string) {
		const _ = await import('lodash');

		const applications = (await sdk.models.application.getAll({
			$expand: {
				organization: {
					$select: ['handle'],
				},
			},
			$filter: {
				$eq: [{ $tolower: { $: 'app_name' } }, appName.toLowerCase()],
			},
			$select: ['id'],
		})) as Array<
			Application & {
				organization: [Organization];
			}
		>;

		if (applications == null || applications.length === 0) {
			throw new ExpectedError(
				stripIndent`
			No applications found with name: ${appName}.

			This could mean that the application does not exist, or you do
			not have the permissions required to access it.`,
			);
		}

		if (applications.length === 1) {
			return applications[0].organization[0].handle;
		}

		// If we got more than one application with the same name it means that the
		// user has access to a collab app with the same name as a personal app. We
		// present a list to the user which shows the fully qualified application
		// name (user/appname) and allows them to select
		const entries = _.map(applications, (app) => {
			const username = app.organization[0].handle;
			return {
				name: `${username}/${appName}`,
				extra: username,
			};
		});

		const { selectFromList } = await import('../utils/patterns');
		const selected = await selectFromList(
			`${entries.length} applications found with that name, please select the application you would like to push to`,
			entries,
		);

		return selected.extra;
	}
}
