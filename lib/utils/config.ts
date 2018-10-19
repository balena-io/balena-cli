/*
Copyright 2016-2017 Balena

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
import Promise = require('bluebird');
import BalenaSdk = require('balena-sdk');
import * as semver from 'resin-semver';

const balena = BalenaSdk.fromSharedOptions();

type ImgConfig = {
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
	pubnubSubscribeKey: string;
	pubnubPublishKey: string;
	mixpanelToken: string;
	wifiSsid?: string;
	wifiKey?: string;

	// props for older OS versions
	connectivity?: string;
	files?: {
		[filepath: string]: string;
	};

	// device specific config props
	deviceId?: number;
	uuid?: string;
	registered_at?: number;
};

export function generateBaseConfig(
	application: BalenaSdk.Application,
	options: { version: string; appUpdatePollInterval?: number },
): Promise<ImgConfig> {
	options = {
		...options,
		appUpdatePollInterval: options.appUpdatePollInterval || 10,
	};

	const promise = balena.models.os.getConfig(
		application.app_name,
		options,
	) as Promise<ImgConfig & { apiKey?: string }>;
	return promise.tap(config => {
		// os.getConfig always returns a config for an app
		delete config.apiKey;
	});
}

export function generateApplicationConfig(
	application: BalenaSdk.Application,
	options: { version: string },
) {
	return generateBaseConfig(application, options).tap(config => {
		if (semver.satisfies(options.version, '>=2.7.8')) {
			return addProvisioningKey(config, application.id);
		} else {
			return addApplicationKey(config, application.id);
		}
	});
}

export function generateDeviceConfig(
	device: BalenaSdk.Device & {
		belongs_to__application: BalenaSdk.PineDeferred;
	},
	deviceApiKey: string | true | null,
	options: { version: string },
) {
	return balena.models.application
		.get(device.belongs_to__application.__id)
		.then(application => {
			return generateBaseConfig(application, options).tap(config => {
				if (deviceApiKey) {
					return addDeviceKey(config, device.uuid, deviceApiKey);
				} else if (semver.satisfies(options.version, '>=2.0.3')) {
					return addDeviceKey(config, device.uuid, true);
				} else {
					return addApplicationKey(config, application.id);
				}
			});
		})
		.then(config => {
			// Associate a device, to prevent the supervisor
			// from creating another one on its own.
			config.registered_at = Math.floor(Date.now() / 1000);
			config.deviceId = device.id;
			config.uuid = device.uuid;

			return config;
		});
}

function addApplicationKey(config: any, applicationNameOrId: string | number) {
	return balena.models.application
		.generateApiKey(applicationNameOrId)
		.tap(apiKey => {
			config.apiKey = apiKey;
		});
}

function addProvisioningKey(config: any, applicationNameOrId: string | number) {
	return balena.models.application
		.generateProvisioningKey(applicationNameOrId)
		.tap(apiKey => {
			config.apiKey = apiKey;
		});
}

function addDeviceKey(
	config: any,
	uuid: string,
	customDeviceApiKey: string | true,
) {
	return Promise.try(() => {
		if (customDeviceApiKey === true) {
			return balena.models.device.generateDeviceKey(uuid);
		} else {
			return customDeviceApiKey;
		}
	}).tap(deviceApiKey => {
		config.deviceApiKey = deviceApiKey;
	});
}
