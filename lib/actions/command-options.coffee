###
Copyright 2016 Resin.io

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

exports.booleanDevice =
	signature: 'device'
	description: 'device'
	boolean: true
	alias: 'd'

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
