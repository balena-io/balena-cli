###
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
###

_ = require('lodash')

exports.yes =
	signature: 'yes'
	description: 'confirm non interactively'
	boolean: true
	alias: 'y'

exports.optionalApplication =
	signature: 'application'
	parameter: 'application'
	description: 'application name'
	alias: [ 'a', 'app' ]

exports.application = _.defaults
	required: 'You have to specify an application'
, exports.optionalApplication

exports.optionalDevice =
	signature: 'device'
	parameter: 'device'
	description: 'device uuid'
	alias: 'd'

exports.optionalDeviceApiKey =
	signature: 'deviceApiKey'
	description: 'custom device key - note that this is only supported on ResinOS 2.0.3+'
	parameter: 'device-api-key'
	alias: 'k'

exports.optionalOsVersion =
	signature: 'version'
	description: 'a resinOS version'
	parameter: 'version'

exports.osVersion = _.defaults
	required: 'You have to specify an exact os version'
, exports.optionalOsVersion

exports.booleanDevice =
	signature: 'device'
	description: 'device'
	boolean: true
	alias: 'd'

exports.osVersionOrSemver =
	signature: 'version'
	description: """
		exact version number, or a valid semver range,
		or 'latest' (includes pre-releases),
		or 'default' (excludes pre-releases if at least one stable version is available),
		or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
		or 'menu' (will show the interactive menu)
	"""
	parameter: 'version'

exports.network =
	signature: 'network'
	parameter: 'network'
	description: 'network type'
	alias: 'n'

exports.wifiSsid =
	signature: 'ssid'
	parameter: 'ssid'
	description: 'wifi ssid, if network is wifi'
	alias: 's'

exports.wifiKey =
	signature: 'key'
	parameter: 'key'
	description: 'wifi key, if network is wifi'
	alias: 'k'

exports.forceUpdateLock =
	signature: 'force'
	description: 'force action if the update lock is set'
	boolean: true
	alias: 'f'

exports.drive =
	signature: 'drive'
	description: 'the drive to write the image to, like `/dev/sdb` or `/dev/mmcblk0`.
		Careful with this as you can erase your hard drive.
		Check `resin util available-drives` for available options.'
	parameter: 'drive'
	alias: 'd'

exports.advancedConfig =
	signature: 'advanced'
	description: 'show advanced configuration options'
	boolean: true
	alias: 'v'

exports.hostOSAccess =
	signature: 'host'
	boolean: true
	description: 'access host OS (for devices with Resin OS >= 2.7.5)'
	alias: 's'
