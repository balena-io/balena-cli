/*
Copyright 2016-2017 Resin.io

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
import ResinSdk = require('resin-sdk');
import _ = require('lodash');
import deviceConfig = require('resin-device-config');
import * as semver from 'resin-semver';

const resin = ResinSdk.fromSharedOptions();

export function generateBaseConfig(
	application: ResinSdk.Application,
	options: { version?: string; appUpdatePollInterval?: number },
) {
	options = _.mapValues(options, function(value, key) {
		if (key === 'appUpdatePollInterval') {
			return options[key]! * 60 * 1000;
		} else {
			return value;
		}
	});

	return Promise.props({
		userId: resin.auth.getUserId(),
		username: resin.auth.whoami(),
		apiUrl: resin.settings.get('apiUrl'),
		vpnUrl: resin.settings.get('vpnUrl'),
		registryUrl: resin.settings.get('registryUrl'),
		deltaUrl: resin.settings.get('deltaUrl'),
		apiConfig: resin.models.config.getAll(),
	}).then(results => {
		return deviceConfig.generate(
			{
				application,
				user: {
					id: results.userId,
					username: results.username,
				},
				endpoints: {
					api: results.apiUrl,
					vpn: results.vpnUrl,
					registry: results.registryUrl,
					delta: results.deltaUrl,
				},
				pubnub: results.apiConfig.pubnub,
				mixpanel: {
					token: results.apiConfig.mixpanelToken,
				},
			},
			options,
		);
	});
}

export function generateApplicationConfig(
	application: ResinSdk.Application,
	options: { version?: string },
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
	device: ResinSdk.Device & { belongs_to__application: ResinSdk.PineDeferred },
	deviceApiKey: string | true | null,
	options: { version?: string },
) {
	return resin.models.application
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
	return resin.models.application
		.generateApiKey(applicationNameOrId)
		.tap(apiKey => {
			config.apiKey = apiKey;
		});
}

function addProvisioningKey(config: any, applicationNameOrId: string | number) {
	return resin.models.application
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
			return resin.models.device.generateDeviceKey(uuid);
		} else {
			return customDeviceApiKey;
		}
	}).tap(deviceApiKey => {
		config.deviceApiKey = deviceApiKey;
	});
}
