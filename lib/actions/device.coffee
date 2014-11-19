_ = require('lodash')
deviceModel = require('../models/device')
getDeviceDisplayName = require('../device/device').getDisplayName
table = require('../table/table')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn (applicationId) ->
	deviceModel.getAll(applicationId).then (devices) ->

		console.log table.horizontal devices, (device) ->
			device.application = device.application[0].app_name
			device.device_type = getDeviceDisplayName(device.device_type)
			delete device.note
			delete device.supervisor_version
			delete device.uuid
			delete device.download_progress
			return device

	.catch (error) ->
		throw error
