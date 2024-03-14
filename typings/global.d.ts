import type { Application, DeviceType, Device } from 'balena-sdk';

declare global {
	type ApplicationWithDeviceTypeSlug = Omit<
		Application,
		'is_for__device_type'
	> & {
		is_for__device_type: [Pick<DeviceType, 'slug'>];
	};
	type DeviceWithDeviceType = Device & {
		is_of__device_type: [DeviceType];
	};
}
