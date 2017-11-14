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

exports.generateBaseConfig = (application, options) ->
	Promise = require('bluebird')
	_ = require('lodash')
	deviceConfig = require('resin-device-config')
	resin = require('resin-sdk-preconfigured')

	options = _.mapValues options, (value, key) ->
		if key == 'appUpdatePollInterval'
			value * 60 * 1000
		else
			value

	Promise.props
		userId: resin.auth.getUserId()
		username: resin.auth.whoami()
		apiUrl: resin.settings.get('apiUrl')
		vpnUrl: resin.settings.get('vpnUrl')
		registryUrl: resin.settings.get('registryUrl')
		deltaUrl: resin.settings.get('deltaUrl')
		pubNubKeys: resin.models.config.getPubNubKeys()
		mixpanelToken: resin.models.config.getMixpanelToken()
	.then (results) ->
		deviceConfig.generate
			application: application
			user:
				id: results.userId
				username: results.username
			endpoints:
				api: results.apiUrl
				vpn: results.vpnUrl
				registry: results.registryUrl
				delta: results.deltaUrl
			pubnub: results.pubNubKeys
			mixpanel:
				token: results.mixpanelToken
		, options

exports.generateApplicationConfig = (application, options) ->
	exports.generateBaseConfig(application, options)
	.tap (config) ->
		authenticateWithApplicationKey(config, application.id)

exports.generateDeviceConfig = (device, deviceApiKey, options) ->
	resin = require('resin-sdk-preconfigured')

	resin.models.application.get(device.application_name)
	.then (application) ->
		exports.generateBaseConfig(application, options)
		.tap (config) ->
			# Device API keys are only safe for ResinOS 2.0.3+. We could somehow obtain
			# the expected version for this config and generate one when we know it's safe,
			# but instead for now we fall back to app keys unless the user has explicitly opted in.
			if deviceApiKey?
				authenticateWithDeviceKey(config, device.uuid, deviceApiKey)
			else
				authenticateWithApplicationKey(config, application.id)
	.then (config) ->
		# Associate a device, to prevent the supervisor
		# from creating another one on its own.
		config.registered_at = Math.floor(Date.now() / 1000)
		config.deviceId = device.id
		config.uuid = device.uuid

		return config

authenticateWithApplicationKey = (config, applicationNameOrId) ->
	resin = require('resin-sdk-preconfigured')
	resin.models.application.generateApiKey(applicationNameOrId)
	.then (apiKey) ->
		config.apiKey = apiKey
		return config

authenticateWithDeviceKey = (config, uuid, customDeviceApiKey) ->
	Promise = require('bluebird')
	resin = require('resin-sdk-preconfigured')

	Promise.try ->
		customDeviceApiKey || resin.models.device.generateDeviceKey(uuid)
	.then (deviceApiKey) ->
		config.deviceApiKey = deviceApiKey
		return config
