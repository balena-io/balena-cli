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
import * as BalenaDeviceStatus from 'balena-device-status';
import { Device } from 'balena-sdk';

export const getDeviceOsProgress = (device: Device) => {
	if (!device.is_online) {
		return 0;
	}

	const status = BalenaDeviceStatus.getStatus(device).key;

	if (
		status === BalenaDeviceStatus.status.UPDATING &&
		!!device.download_progress
	) {
		return device.download_progress;
	}
	if (
		(status === BalenaDeviceStatus.status.CONFIGURING ||
			status === BalenaDeviceStatus.status.POST_PROVISIONING) &&
		device.provisioning_progress
	) {
		return device.provisioning_progress;
	}

	return 0;
};
