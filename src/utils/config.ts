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
import { getBalenaSdk, stripIndent } from './lazy';
import type { PropsOfType } from 'balena-sdk/typings/utils';

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

	developmentMode?: boolean;
	installer?: {
		secureboot?: boolean;
	};
}

export async function generateApplicationConfig(
	application: Pick<BalenaSdk.Application['Read'], 'slug'>,
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
		// eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
		appUpdatePollInterval: options.appUpdatePollInterval || 10,
	};

	const config = (await getBalenaSdk().models.os.getConfig(
		application.slug,
		options,
	)) as ImgConfig;

	// merge sshKeys to config, when they have been specified
	if (options.os?.sshKeys) {
		// Create config.os object if it does not exist
		config.os ??= {};
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

export async function generateDeviceConfig(
	device: DeviceWithDeviceType & {
		belongs_to__application: BalenaSdk.PineDeferred;
	},
	deviceApiKey: string | undefined,
	options: { version: string },
): Promise<ImgConfig> {
	const sdk = getBalenaSdk();
	const application = await sdk.models.application.get(
		device.belongs_to__application.__id,
	);

	const baseConfigOpts = {
		...options,
		deviceType: device.is_of__device_type[0].slug,
	};
	// TODO: Generate the correct key beforehand and pass it to os.getConfig() once
	// the API supports injecting a provided key, to avoid generating an unused one.
	const config = await generateApplicationConfig(application, baseConfigOpts);
	populateDeviceConfig(
		config,
		device,
		typeof deviceApiKey === 'string' && deviceApiKey
			? deviceApiKey
			: await sdk.models.device.generateDeviceKey(device.uuid),
	);

	return config;
}

export function populateDeviceConfig(
	config: ImgConfig | PartiallyValidatedConfigJson,
	device: { id: number; uuid: string },
	deviceApiKey: string,
) {
	// Delete any Provisioning Api Key that might be there
	// eg: os.getConfig always returns a config for the app.
	delete config.apiKey;

	config.deviceApiKey = deviceApiKey;

	// Associate a device, to prevent the supervisor
	// from creating another one on its own.
	config.registered_at = Math.floor(Date.now() / 1000);
	config.deviceId = device.id;
	config.uuid = device.uuid;
}

export type PartiallyValidatedConfigJson = Awaited<
	ReturnType<typeof readAndValidateConfigJson>
>;

const numericConfigJsonFields = [
	'applicationId',
	'userId',
	'appUpdatePollInterval',
	'listenPort',
	'vpnPort',
	'deviceId',
	'registered_at',
] satisfies Array<PropsOfType<ImgConfig, number | undefined>>;

export async function readAndValidateConfigJson(path: string) {
	const fs = await import('fs/promises');
	const [rawConfig, { ExpectedError }] = await Promise.all([
		fs.readFile(path, 'utf8'),
		import('../errors'),
	]);
	const configJson: Partial<Record<keyof ImgConfig, unknown>> | undefined =
		JSON.parse(rawConfig);
	if (configJson == null || typeof configJson !== 'object') {
		throw new ExpectedError(`Invalid config.json file: ${path}`);
	}
	// Numeric fields of the config.json, like the applicationId,
	// are actually quoted strings in images downloaded from the image maker.
	for (const fieldToParse of numericConfigJsonFields) {
		// TODO: A cli major some years after the API completely moves to using
		// POST requests to the image-maker, we can consider dropping support
		// for parsing the config.json of OS images downloaded while the API
		// was still using GETs, in favor of just validating the type & throwing.
		// https://github.com/balena-io/balena-api/pull/6094
		if (
			typeof configJson[fieldToParse] === 'string' &&
			/^[1-9]\d+$/.test(configJson[fieldToParse])
		) {
			configJson[fieldToParse] = parseInt(configJson[fieldToParse], 10);
		}
	}
	if (
		typeof configJson.applicationId !== 'number' ||
		!Number.isInteger(configJson.applicationId)
	) {
		throw new ExpectedError('Missing or invalid applicationId in config.json');
	}
	if (
		typeof configJson.deviceType !== 'string' ||
		configJson.deviceType === ''
	) {
		throw new ExpectedError('Missing or invalid deviceType in config.json');
	}
	if (
		configJson.installer != null &&
		typeof configJson.installer === 'object' &&
		'secureboot' in configJson.installer &&
		configJson.installer.secureboot === 'true'
	) {
		configJson.installer.secureboot = true;
	}
	// At some point TS might be able to infer the types of the props that we have already checked,
	// but atm we have to cast the result manually.
	return configJson as typeof configJson &
		Required<Pick<ImgConfig, 'applicationId' | 'deviceType' | 'installer'>>;
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
	logger?: import('./logger'),
) {
	if (!dev) {
		return;
	}
	if (version && /\bprod\b/.test(version)) {
		const { ExpectedError } = await import('../errors');
		throw new ExpectedError(
			`Error: The '--dev' option conflicts with production balenaOS version '${version}'`,
		);
	}
	if (!logger) {
		const Logger = await import('./logger');
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
	logger?: import('./logger'),
) {
	if (!secureBoot) {
		return;
	}
	const { ExpectedError } = await import('../errors');
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

	const contract = osRelease.contract as BalenaSdk.Contract | null;
	if (
		contract?.provides?.some((entry) => {
			return entry.type === 'sw.feature' && entry.slug === 'secureboot';
		})
	) {
		if (!logger) {
			const Logger = await import('./logger');
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
