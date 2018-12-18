/*
Copyright 2016-2018 Balena Ltd.

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

import { CommandDefinition } from 'capitano';
import { stripIndent } from 'common-tags';
import { BalenaSDK } from 'balena-sdk';

import { BuildError } from '../utils/device/errors';

// An regex to detect an IP address, from https://www.regular-expressions.info/ip.html
const IP_REGEX = new RegExp(
	/\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/,
);

enum BuildTarget {
	Cloud,
	Device,
}

function getBuildTarget(appOrDevice: string): BuildTarget | null {
	// First try the application regex from the api
	if (/^[a-zA-Z0-9_-]+$/.test(appOrDevice)) {
		return BuildTarget.Cloud;
	}

	if (IP_REGEX.test(appOrDevice)) {
		return BuildTarget.Device;
	}

	return null;
}

async function getAppOwner(sdk: BalenaSDK, appName: string) {
	const {
		exitWithExpectedError,
		selectFromList,
	} = await import('../utils/patterns');
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
		exitWithExpectedError(
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
	const entries = _.map(applications, app => {
		const username = _.get(app, 'user[0].username');
		return {
			name: `${username}/${appName}`,
			extra: username,
		};
	});

	const selected = await selectFromList(
		`${
			entries.length
		} applications found with that name, please select the application you would like to push to`,
		entries,
	);

	return selected.extra;
}

interface RegistrySecrets {
	[registryAddress: string]: {
		username: string;
		password: string;
	};
}

async function parseRegistrySecrets(
	secretsFilename: string,
): Promise<RegistrySecrets> {
	const { fs } = await require('mz');
	const { RegistrySecretValidator } = await require('resin-multibuild');
	try {
		let isYaml = false;
		if (/.+\.ya?ml$/i.test(secretsFilename)) {
			isYaml = true;
		} else if (!/.+\.json$/i.test(secretsFilename)) {
			throw new Error('Filename must end with .json, .yml or .yaml');
		}
		const raw = (await fs.readFile(secretsFilename)).toString();
		return new RegistrySecretValidator().validateRegistrySecrets(
			isYaml ? (await require('js-yaml')).safeLoad(raw) : JSON.parse(raw),
		);
	} catch (error) {
		error.message =
			`Error validating registry secrets file "${secretsFilename}":\n` +
			error.message;
		throw error;
	}
}

export const push: CommandDefinition<
	{
		applicationOrDevice: string;
	},
	{
		source: string;
		emulated: boolean;
		nocache: boolean;
		'registry-secrets': string;
	}
> = {
	signature: 'push <applicationOrDevice>',
	description:
		'Start a remote build on the balena cloud build servers or a local mode device',
	help: stripIndent`
		This command can be used to start a build on the remote balena cloud builders,
		or a local mode balena device.

		When building on the balena cloud the given source directory will be sent to the
		balena builder, and the build will proceed. This can be used as a drop-in
		replacement for git push to deploy.

		When building on a local mode device, the given source directory will be built
		on the device, and the resulting containers will be run on the device. Logs will
		be streamed back from the device as part of the same invocation.

		The --registry-secrets option specifies a JSON or YAML file containing private
		Docker registry usernames and passwords to be used when pulling base images.
		Sample registry-secrets YAML file:

			'https://idx.docker.io/v1/':
				username: mike
				password: cze14
			'myregistry.com:25000':
				username: ann
				password: hunter2


		Examples:

			$ balena push myApp
			$ balena push myApp --source <source directory>
			$ balena push myApp -s <source directory>

			$ balena push 10.0.0.1
			$ balena push 10.0.0.1 --source <source directory>
			$ balena push 10.0.0.1 -s <source directory>
	`,
	permission: 'user',
	options: [
		{
			signature: 'source',
			alias: 's',
			description:
				'The source that should be sent to the balena builder to be built (defaults to the current directory)',
			parameter: 'source',
		},
		{
			signature: 'emulated',
			alias: 'e',
			description: 'Force an emulated build to occur on the remote builder',
			boolean: true,
		},
		{
			signature: 'nocache',
			alias: 'c',
			description: "Don't use cache when building this project",
			boolean: true,
		},
		{
			signature: 'registry-secrets',
			alias: 'R',
			parameter: 'secrets.yml|.json',
			description: stripIndent`
				Path to a local YAML or JSON file containing Docker registry passwords used to pull base images`,
		},
	],
	async action(params, options, done) {
		const sdk = (await import('balena-sdk')).fromSharedOptions();
		const Bluebird = await import('bluebird');
		const remote = await import('../utils/remote-build');
		const deviceDeploy = await import('../utils/device/deploy');
		const { exitWithExpectedError } = await import('../utils/patterns');

		const appOrDevice: string | null = params.applicationOrDevice;
		if (appOrDevice == null) {
			exitWithExpectedError('You must specify an application or a device');
		}

		const source = options.source || '.';
		if (process.env.DEBUG) {
			console.log(`[debug] Using ${source} as build source`);
		}

		const registrySecrets = options['registry-secrets']
			? await parseRegistrySecrets(options['registry-secrets'])
			: {};

		const buildTarget = getBuildTarget(appOrDevice);
		switch (buildTarget) {
			case BuildTarget.Cloud:
				const app = appOrDevice;
				Bluebird.join(
					sdk.auth.getToken(),
					sdk.settings.get('balenaUrl'),
					getAppOwner(sdk, app),
					(token, baseUrl, owner) => {
						const opts = {
							emulated: options.emulated,
							nocache: options.nocache,
							registrySecrets,
						};
						const args = {
							app,
							owner,
							source,
							auth: token,
							baseUrl,
							sdk,
							opts,
						};

						return remote.startRemoteBuild(args);
					},
				).nodeify(done);
				break;
			case BuildTarget.Device:
				const device = appOrDevice;
				// TODO: Support passing a different port
				Bluebird.resolve(
					deviceDeploy.deployToDevice({
						source,
						deviceHost: device,
						registrySecrets,
					}),
				)
					.catch(BuildError, e => {
						exitWithExpectedError(e.toString());
					})
					.nodeify(done);
				break;
			default:
				exitWithExpectedError(
					stripIndent`
					Build target not recognised. Please provide either an application name or device address.

					The only supported device addresses currently are IP addresses.

					If you believe your build target should have been detected, and this is an error, please
					create an issue.`,
				);
				break;
		}
	},
};
