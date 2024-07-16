/*
Copyright 2016-2019 Balena

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
import type * as BalenaSdk from 'balena-sdk';
import * as semver from 'balena-semver';
import { getBalenaSdk, stripIndent } from './lazy.js';

export interface ImgConfig {
	applicationName: string;
	applicationId: number;
	deviceType: string;
	userId: number;
	username: string;
	appUpdatePollInterval: number;
	listenPort: number;
	vpnPort: number;
	apiEndpoint: string;
	vpnEndpoint: string;
	registryEndpoint: string;
	deltaEndpoint: string;
	mixpanelToken: string;
	wifiSsid?: string;
	wifiKey?: string;
	initialDeviceName?: string;

	apiKey?: string;
	deviceApiKey?: string;

	// props for older OS versions
	connectivity?: string;
	files?: {
		[filepath: string]: string;
	};

	// device specific config props
	deviceId?: number;
	uuid?: string;
	registered_at?: number;

	os?: {
		sshKeys?: string[];
	};

	installer?: {
		secureboot?: boolean;
	};
}

export async function generateApplicationConfig(
	application: Pick<BalenaSdk.Application, 'slug'>,
	options: {
		version: string;
		appUpdatePollInterval?: number;
		deviceType?: string;
		os?: {
			sshKeys?: string[];
		};
		secureBoot?: boolean;
	},
): Promise<ImgConfig> {
	options = {
		...options,
		appUpdatePollInterval: options.appUpdatePollInterval || 10,
	};

	const config = (await getBalenaSdk().models.os.getConfig(
		application.slug,
		options,
	)) as ImgConfig;

	// merge sshKeys to config, when they have been specified
	if (options.os && options.os.sshKeys) {
		// Create config.os object if it does not exist
		config.os = config.os ? config.os : {};
		config.os.sshKeys = config.os.sshKeys
			? [...config.os.sshKeys, ...options.os.sshKeys]
			: options.os.sshKeys;
	}

	// configure installer secure boot opt-in if specified
	if (options.secureBoot) {
		config.installer ??= {};
		config.installer.secureboot = options.secureBoot;
	}

	return config;
}

export function generateDeviceConfig(
	device: DeviceWithDeviceType & {
		belongs_to__application: BalenaSdk.PineDeferred;
	},
	deviceApiKey: string | true | undefined,
	options: { version: string },
) {
	const sdk = getBalenaSdk();
	return sdk.models.application
		.get(device.belongs_to__application.__id)
		.then(async (application) => {
			const baseConfigOpts = {
				...options,
				deviceType: device.is_of__device_type[0].slug,
			};
			// TODO: Generate the correct key beforehand and pass it to os.getConfig() once
			// the API supports injecting a provided key, to avoid generating an unused one.
			const config = await generateApplicationConfig(
				application,
				baseConfigOpts,
			);
			// os.getConfig always returns a config for an app
			delete config.apiKey;

			if (deviceApiKey == null && semver.satisfies(options.version, '<2.0.3')) {
				config.apiKey = await sdk.models.application.generateApiKey(
					application.id,
				);
			} else {
				config.deviceApiKey =
					typeof deviceApiKey === 'string' && deviceApiKey
						? deviceApiKey
						: await sdk.models.device.generateDeviceKey(device.uuid);
			}

			return config;
		})
		.then((config) => {
			// Associate a device, to prevent the supervisor
			// from creating another one on its own.
			config.registered_at = Math.floor(Date.now() / 1000);
			config.deviceId = device.id;
			config.uuid = device.uuid;

			return config;
		});
}

/**
 * Chech whether the `--dev` option of commands related to OS configuration
 * such as `os configure` and `config generate` is compatible with a given
 * balenaOS version, and print a warning regarding the consequences of using
 * that option.
 */
export async function validateDevOptionAndWarn(
	dev?: boolean,
	version?: string,
	logger?: import('./logger.js').default,
) {
	if (!dev) {
		return;
	}
	if (version && /\bprod\b/.test(version)) {
		const { ExpectedError } = await import('../errors.js');
		throw new ExpectedError(
			`Error: The '--dev' option conflicts with production balenaOS version '${version}'`,
		);
	}
	if (!logger) {
		const { default: Logger } = await import('./logger.js');
		logger = Logger.getLogger();
	}
	logger.logInfo(stripIndent`
		The '--dev' option is being used to configure a balenaOS image in development mode.
		Please note that development mode allows unauthenticated, passwordless root ssh access
		and exposes network ports such as 2375 that allows unencrypted access to balenaEngine.
		Therefore, development mode should only be used in private, trusted local networks.`);
}

/**
 * Chech whether the `--secureBoot` option of commands related to OS configuration
 * such as `os configure` and `config generate` is compatible with a given
 * OS release, and print a warning regarding the consequences of using that
 * option.
 */
export async function validateSecureBootOptionAndWarn(
	secureBoot: boolean,
	slug: string,
	version: string,
	logger?: import('./logger.js').default,
) {
	if (!secureBoot) {
		return;
	}
	const { ExpectedError } = await import('../errors.js');
	if (!version) {
		throw new ExpectedError(`Error: No version provided`);
	}
	if (!slug) {
		throw new ExpectedError(`Error: No device type provided`);
	}
	const sdk = getBalenaSdk();
	const [osRelease] = await sdk.models.os.getAllOsVersions(slug, {
		$select: 'contract',
		$filter: { raw_version: version },
	});
	if (!osRelease) {
		throw new ExpectedError(`Error: No ${version} release for ${slug}`);
	}

	const contract = osRelease.contract ? JSON.parse(osRelease.contract) : null;
	if (
		contract?.provides.some((entry: Dictionary<string>) => {
			return entry.type === 'sw.feature' && entry.slug === 'secureboot';
		})
	) {
		if (!logger) {
			const { default: Logger } = await import('./logger.js');
			logger = Logger.getLogger();
		}
		logger.logInfo(stripIndent`
			The '--secureBoot' option is being used to configure a balenaOS installer image
			into secure boot and full disk encryption.`);
	} else {
		throw new ExpectedError(
			`Error: The '--secureBoot' option is not supported for ${slug} in ${version}`,
		);
	}
}
