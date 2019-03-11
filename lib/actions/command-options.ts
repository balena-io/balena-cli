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

import _ = require('lodash');

export const yes = {
	signature: 'yes',
	description: 'confirm non interactively',
	boolean: true,
	alias: 'y',
};

export const optionalApplication = {
	signature: 'application',
	parameter: 'application',
	description: 'application name',
	alias: ['a', 'app'],
};

export const application = _.defaults(
	{ required: 'You have to specify an application' },
	optionalApplication,
);

export const optionalRelease = {
	signature: 'release',
	parameter: 'release',
	description: 'release id',
	alias: 'r',
};

export const optionalDevice = {
	signature: 'device',
	parameter: 'device',
	description: 'device uuid',
	alias: 'd',
};

export const optionalDeviceApiKey = {
	signature: 'deviceApiKey',
	description:
		'custom device key - note that this is only supported on balenaOS 2.0.3+',
	parameter: 'device-api-key',
	alias: 'k',
};

export const optionalDeviceType = {
	signature: 'deviceType',
	description: 'device type slug',
	parameter: 'device-type',
};

export const optionalOsVersion = {
	signature: 'version',
	description: 'a balenaOS version',
	parameter: 'version',
};

export const osVersion = _.defaults(
	{
		required: 'You have to specify an exact os version',
	},
	exports.optionalOsVersion,
);

export const booleanDevice = {
	signature: 'device',
	description: 'device',
	boolean: true,
	alias: 'd',
};

export const osVersionOrSemver = {
	signature: 'version',
	description: `\
exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)\
`,
	parameter: 'version',
};

export const network = {
	signature: 'network',
	parameter: 'network',
	description: 'network type',
	alias: 'n',
};

export const wifiSsid = {
	signature: 'ssid',
	parameter: 'ssid',
	description: 'wifi ssid, if network is wifi',
	alias: 's',
};

export const wifiKey = {
	signature: 'key',
	parameter: 'key',
	description: 'wifi key, if network is wifi',
	alias: 'k',
};

export const forceUpdateLock = {
	signature: 'force',
	description: 'force action if the update lock is set',
	boolean: true,
	alias: 'f',
};

export const drive = {
	signature: 'drive',
	description: `the drive to write the image to, like \`/dev/sdb\` or \`/dev/mmcblk0\`. \
Careful with this as you can erase your hard drive. \
Check \`balena util available-drives\` for available options.`,
	parameter: 'drive',
	alias: 'd',
};

export const advancedConfig = {
	signature: 'advanced',
	description: 'show advanced configuration options',
	boolean: true,
	alias: 'v',
};

export const hostOSAccess = {
	signature: 'host',
	boolean: true,
	description: 'access host OS (for devices with balenaOS >= 2.0.0+rev1)',
	alias: 's',
};
