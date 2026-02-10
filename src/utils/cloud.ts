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

import type * as SDK from 'balena-sdk';
import * as _ from 'lodash';
import { stripIndent } from './lazy';

import { ExpectedError } from '../errors';

export const serviceIdToName = _.memoize(
	async (
		sdk: SDK.BalenaSDK,
		serviceId: number,
	): Promise<string | undefined> => {
		const serviceName = await sdk.pine.get({
			resource: 'service',
			id: serviceId,
			options: {
				$select: 'service_name',
			},
		});

		if (serviceName != null) {
			return serviceName.service_name;
		}
		return;
	},
	// Memoize the call based on service id
	(_sdk, id) => id.toString(),
);

const deviceOptions = {
	$select: ['id', 'uuid'],
	$expand: { belongs_to__application: { $select: ['slug'] } },
} as const;

type DeviceWithOptions = NonNullable<
	SDK.Pine.OptionsToResponse<SDK.Device['Read'], typeof deviceOptions, string>
>;
/**
 * Return Device and Application objects for the given device UUID (short UUID
 * or full UUID). An error is thrown if the application is not accessible, e.g.
 * if the application owner removed the current user as a collaborator (but the
 * device still belongs to the current user).
 */
export const getDeviceAndAppFromUUID = _.memoize(
	async (
		deviceUUID: string,
	): Promise<
		[DeviceWithOptions, DeviceWithOptions['belongs_to__application'][number]]
	> => {
		const [device, app] = await getDeviceAndMaybeAppFromUUID(deviceUUID);
		if (app == null) {
			throw new ExpectedError(stripIndent`
				Unable to access the fleet that device ${deviceUUID} belongs to.
				Hint: check whether the fleet owner withdrew access to it.
			`);
		}

		return [device, app] as const;
	},
);

/**
 * Return a Device object and maybe an Application object for the given device
 * UUID (short UUID or full UUID). The Application object may be undefined if
 * the user / device lost access to the application, e.g. if the application
 * owner removed the user as a collaborator (but the device still belongs to
 * the current user).
 */
export const getDeviceAndMaybeAppFromUUID = _.memoize(
	async (
		deviceUUID: string,
	): Promise<
		| [DeviceWithOptions, DeviceWithOptions['belongs_to__application'][number]]
		| [DeviceWithOptions, undefined]
	> => {
		const { getDevice } = await import('./sdk');
		const device = await getDevice(deviceUUID, deviceOptions);
		return [device, device.belongs_to__application[0]] as const;
	},
);
