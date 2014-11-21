_ = require('lodash')
deviceModel = require('../models/device')
getDeviceDisplayName = require('../device/device').getDisplayName
log = require('../log/log')
table = require('../table/table')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn (applicationId) ->
	deviceModel.getAll(applicationId).then (devices) ->

		log.out table.horizontal devices, (device) ->
			device.application = device.application[0].app_name
			device.device_type = getDeviceDisplayName(device.device_type)
			delete device.note
			delete device.supervisor_version
			delete device.uuid
			delete device.download_progress
			return device
		, [ 'ID', 'Name', 'Device Type', 'Is Online', 'IP Address', 'Application', 'Status', 'Last Seen' ]

	.catch (error) ->
		throw error
