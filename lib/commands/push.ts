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
import { isV13 } from '../utils/version';
import { RegistrySecrets } from 'resin-multibuild';
import { lowercaseIfSlug } from '../utils/normalization';
import {
	applyReleaseTagKeysAndValues,
	parseReleaseTagKeysAndValues,
} from '../utils/compose_ts';

enum BuildTarget {
	Cloud,
	Device,
}

interface ArgsDef {
	applicationOrDevice: string;
}

interface FlagsDef {
	source: string;
	emulated: boolean;
	dockerfile?: string; // DeviceDeployOptions.dockerfilePath (alternative Dockerfile)
	nocache: boolean;
	pull: boolean;
	'noparent-check': boolean;
	'registry-secrets'?: string;
	gitignore?: boolean;
	nogitignore?: boolean;
	nolive: boolean;
	detached: boolean;
	service?: string[];
	system: boolean;
	env?: string[];
	'convert-eol'?: boolean;
	'noconvert-eol': boolean;
	'multi-dockerignore': boolean;
	'release-tag'?: string[];
	help: void;
}

export default class PushCmd extends Command {
	public static description = stripIndent`
		Start a build on the remote balenaCloud build servers, or a local mode device.

		Start a build on the remote balenaCloud build servers, or a local mode device.

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
		'$ balena push myApp --release-tag key1 "" key2 "value2 with spaces"',
		'$ balena push myorg/myapp',
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
			description:
				'application name or slug, or local device IP address or hostname',
			required: true,
			parse: lowercaseIfSlug,
		},
	];

	public static usage = 'push <applicationOrDevice>';

	public static flags: flags.Input<FlagsDef> = {
		source: flags.string({
			description: stripIndent`
				Source directory to be sent to balenaCloud or balenaOS device
				(default: current working dir)`,
			char: 's',
			default: '.',
		}),
		emulated: flags.boolean({
			description: stripIndent`
				Don't use native ARM servers; force QEMU ARM emulation on Intel x86-64
				servers during the image build (balenaCloud).`,
			char: 'e',
			default: false,
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
			default: false,
		}),
		pull: flags.boolean({
			description: stripIndent`
				When pushing to a local device, force the base images to be pulled again.
				Currently this option is ignored when pushing to the balenaCloud builders.`,
			default: false,
		}),
		'noparent-check': flags.boolean({
			description: stripIndent`
				Disable project validation check of 'docker-compose.yml' file in parent folder`,
			default: false,
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
			default: false,
		}),
		detached: flags.boolean({
			description: stripIndent`
				When pushing to the cloud, this option will cause the build to start, then
				return execution back to the shell, with the status and release ID (if
				applicable).  When pushing to a local mode device, this option will cause
				the command to not tail application logs when the build has completed.`,
			char: 'd',
			default: false,
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
			default: false,
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
		...(isV13()
			? {}
			: {
					'convert-eol': flags.boolean({
						description: 'No-op and deprecated since balena CLI v12.0.0',
						char: 'l',
						hidden: true,
						default: false,
					}),
			  }),
		'noconvert-eol': flags.boolean({
			description: `Don't convert line endings from CRLF (Windows format) to LF (Unix format).`,
			default: false,
		}),
		'multi-dockerignore': flags.boolean({
			description:
				'Have each service use its own .dockerignore file. See "balena help push".',
			char: 'm',
			default: false,
			exclusive: ['gitignore'],
		}),
		...(isV13()
			? {}
			: {
					nogitignore: flags.boolean({
						description:
							'No-op (default behavior) since balena CLI v12.0.0. See "balena help push".',
						char: 'G',
						hidden: true,
						default: false,
					}),
			  }),
		gitignore: flags.boolean({
			description: stripIndent`
		Consider .gitignore files in addition to the .dockerignore file. This reverts
		to the CLI v11 behavior/implementation (deprecated) if compatibility is
		required until your project can be adapted.`,
			char: 'g',
			default: false,
			exclusive: ['multi-dockerignore'],
		}),
		'release-tag': flags.string({
			description: stripIndent`
				Set release tags if the push to a cloud application is successful. Multiple
				arguments may be provided, alternating tag keys and values (see examples).
				Hint: Empty values may be specified with "" (bash, cmd.exe) or '""' (PowerShell).
			`,
			multiple: true,
			exclusive: ['detached'],
		}),
		help: cf.help,
	};

	public static primary = true;

	public async run() {
		const { args: params, flags: options } = this.parse<FlagsDef, ArgsDef>(
			PushCmd,
		);

		const logger = await Command.getLogger();
		logger.logDebug(`Using build source directory: ${options.source} `);

		const sdk = getBalenaSdk();
		const { validateProjectDirectory } = await import('../utils/compose_ts');
		const { dockerfilePath, registrySecrets } = await validateProjectDirectory(
			sdk,
			{
				dockerfilePath: options.dockerfile,
				noParentCheck: options['noparent-check'],
				projectPath: options.source,
				registrySecretsPath: options['registry-secrets'],
			},
		);

		switch (await this.getBuildTarget(params.applicationOrDevice)) {
			case BuildTarget.Cloud:
				logger.logDebug(
					`Pushing to cloud for application: ${params.applicationOrDevice}`,
				);

				await this.pushToCloud(
					params.applicationOrDevice,
					options,
					sdk,
					dockerfilePath,
					registrySecrets,
				);
				break;

			case BuildTarget.Device:
				logger.logDebug(
					`Pushing to local device: ${params.applicationOrDevice}`,
				);
				await this.pushToDevice(
					params.applicationOrDevice,
					options,
					dockerfilePath,
					registrySecrets,
				);
				break;
		}
	}

	protected async pushToCloud(
		appNameOrSlug: string,
		options: FlagsDef,
		sdk: BalenaSDK,
		dockerfilePath: string,
		registrySecrets: RegistrySecrets,
	) {
		const remote = await import('../utils/remote-build');
		const { getApplication } = await import('../utils/sdk');

		// Check for invalid options
		const localOnlyOptions: Array<keyof FlagsDef> = [
			'nolive',
			'service',
			'system',
			'env',
		];
		this.checkInvalidOptions(
			localOnlyOptions,
			options,
			'is only valid when pushing to a local mode device',
		);

		const { releaseTagKeys, releaseTagValues } = parseReleaseTagKeysAndValues(
			options['release-tag'] ?? [],
		);

		await Command.checkLoggedIn();
		const [token, baseUrl] = await Promise.all([
			sdk.auth.getToken(),
			sdk.settings.get('balenaUrl'),
		]);

		const application = (await getApplication(sdk, appNameOrSlug, {
			$expand: {
				organization: {
					$select: ['handle'],
				},
			},
			$select: ['app_name', 'slug'],
		})) as Application & {
			organization: [Organization];
		};

		// * Temporary fix *
		// When doing `$expand organization` on a public app (when not the owner)
		// a partial document is returned without any organization data.
		// So e.g. `balena push balena-sound` will break this commands logic.
		// The balena cloud builder api will soon change to accept application slugs
		// instead of `owner, app`, after which we will not need to do the expand
		//
		// Users should not be pushing to public apps anyway, so for now catch this situation:
		if (!application.organization[0]) {
			throw new ExpectedError(stripIndent`
				You do not have permissions to push to application ${application.slug}.
				If you are trying to deploy a public app, please make sure that you have created
				your own application first.
			`);
		}

		const opts = {
			dockerfilePath,
			emulated: options.emulated,
			multiDockerignore: options['multi-dockerignore'],
			nocache: options.nocache,
			registrySecrets,
			headless: options.detached,
			convertEol: !options['noconvert-eol'],
		};
		const args = {
			app: application.app_name,
			owner: application.organization[0].handle,
			source: options.source,
			auth: token,
			baseUrl,
			nogitignore: !options.gitignore,
			sdk,
			opts,
		};
		const releaseId = await remote.startRemoteBuild(args);
		if (releaseId) {
			await applyReleaseTagKeysAndValues(
				sdk,
				releaseId,
				releaseTagKeys,
				releaseTagValues,
			);
		} else if (releaseTagKeys.length > 0) {
			throw new Error(stripIndent`
				A release ID could not be parsed out of the builder's output.
				As a result, the release tags have not been set.`);
		}
	}

	protected async pushToDevice(
		localDeviceAddress: string,
		options: FlagsDef,
		dockerfilePath: string,
		registrySecrets: RegistrySecrets,
	) {
		// Check for invalid options
		const remoteOnlyOptions: Array<keyof FlagsDef> = ['release-tag'];
		this.checkInvalidOptions(
			remoteOnlyOptions,
			options,
			'is only valid when pushing to an application',
		);

		const deviceDeploy = await import('../utils/device/deploy');

		try {
			await deviceDeploy.deployToDevice({
				source: options.source,
				deviceHost: localDeviceAddress,
				dockerfilePath,
				registrySecrets,
				multiDockerignore: options['multi-dockerignore'],
				nocache: options.nocache,
				pull: options.pull,
				nogitignore: !options.gitignore,
				noParentCheck: options['noparent-check'],
				nolive: options.nolive,
				detached: options.detached,
				services: options.service,
				system: options.system,
				env: options.env || [],
				convertEol: !options['noconvert-eol'],
			});
		} catch (e) {
			const { BuildError } = await import('../utils/device/errors');
			if (instanceOf(e, BuildError)) {
				throw new ExpectedError(e.toString());
			} else {
				throw e;
			}
		}
	}

	protected async getBuildTarget(appOrDevice: string): Promise<BuildTarget> {
		const { validateLocalHostnameOrIp } = await import('../utils/validation');

		return validateLocalHostnameOrIp(appOrDevice)
			? BuildTarget.Device
			: BuildTarget.Cloud;
	}

	protected checkInvalidOptions(
		invalidOptions: Array<keyof FlagsDef>,
		options: FlagsDef,
		errorMessage: string,
	) {
		invalidOptions.forEach((opt) => {
			if (options[opt]) {
				throw new ExpectedError(`The --${opt} flag ${errorMessage}`);
			}
		});
	}
}
