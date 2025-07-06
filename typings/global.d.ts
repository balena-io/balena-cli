import type { Application, DeviceType, Device } from 'balena-sdk';

declare global {
	type ApplicationWithDeviceTypeSlug = Omit<
		Application['Read'],
		'is_for__device_type'
	> & {
		is_for__device_type: Array<Pick<DeviceType['Read'], 'slug'>>;
	};
	type DeviceWithDeviceType = Omit<Device['Read'], 'is_of__device_type'> & {
		is_of__device_type: [DeviceType['Read']];
	};
}
