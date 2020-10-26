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
import { getBalenaSdk } from './lazy';

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
}

export async function generateBaseConfig(
	application: BalenaSdk.Application,
	options: {
		version: string;
		appUpdatePollInterval?: number;
		deviceType?: string;
		os?: {
			sshKeys?: string[];
		};
	},
): Promise<ImgConfig> {
	options = {
		...options,
		appUpdatePollInterval: options.appUpdatePollInterval || 10,
	};

	const config = (await getBalenaSdk().models.os.getConfig(
		application.slug,
		options,
	)) as ImgConfig & { apiKey?: string };
	// os.getConfig always returns a config for an app
	delete config.apiKey;

	// merge sshKeys to config, when they have been specified
	if (options.os && options.os.sshKeys) {
		// Create config.os object if it does not exist
		config.os = config.os ? config.os : {};
		config.os.sshKeys = config.os.sshKeys
			? [...config.os.sshKeys, ...options.os.sshKeys]
			: options.os.sshKeys;
	}

	return config;
}

export async function generateApplicationConfig(
	application: BalenaSdk.Application,
	options: {
		version: string;
		deviceType?: string;
		appUpdatePollInterval?: number;
	},
) {
	const config = await generateBaseConfig(application, options);

	if (semver.satisfies(options.version, '<2.7.8')) {
		await addApplicationKey(config, application.id);
	} else {
		await addProvisioningKey(config, application.id);
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
	return getBalenaSdk()
		.models.application.get(device.belongs_to__application.__id)
		.then(async (application) => {
			const baseConfigOpts = {
				...options,
				deviceType: device.is_of__device_type[0].slug,
			};
			const config = await generateBaseConfig(application, baseConfigOpts);

			if (deviceApiKey == null && semver.satisfies(options.version, '<2.0.3')) {
				await addApplicationKey(config, application.id);
			} else {
				await addDeviceKey(config, device.uuid, deviceApiKey || true);
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

function addApplicationKey(config: any, applicationNameOrId: string | number) {
	return getBalenaSdk()
		.models.application.generateApiKey(applicationNameOrId)
		.then((apiKey) => {
			config.apiKey = apiKey;
			return apiKey;
		});
}

function addProvisioningKey(config: any, applicationNameOrId: string | number) {
	return getBalenaSdk()
		.models.application.generateProvisioningKey(applicationNameOrId)
		.then((apiKey) => {
			config.apiKey = apiKey;
			return apiKey;
		});
}

async function addDeviceKey(
	config: any,
	uuid: string,
	customDeviceApiKey: string | true,
) {
	if (customDeviceApiKey === true) {
		config.deviceApiKey = await getBalenaSdk().models.device.generateDeviceKey(
			uuid,
		);
	} else {
		config.deviceApiKey = customDeviceApiKey;
	}
}
