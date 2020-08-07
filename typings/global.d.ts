import { Application, DeviceType, Device } from 'balena-sdk';

declare global {
	type ApplicationWithDeviceType = Application & {
		is_for__device_type: [DeviceType];
	};
	type DeviceWithDeviceType = Device & {
		is_of__device_type: [DeviceType];
	};
}
