getDeviceDisplayName = require('../device/device').getDisplayName
log = require('../log/log')
table = require('../table/table')
errors = require('../errors/errors')
resin = require('../resin')
widgets = require('../widgets/widgets')
patterns = require('../patterns/patterns')
authHooks = require('../hooks/auth')
config = require('../config')

exports.list = authHooks.failIfNotLoggedIn (applicationId) ->
	resin.models.device.getAll(applicationId).then (devices) ->

		log.out table.horizontal devices, (device) ->
			device.application = device.application[0].app_name
			device.device_type = getDeviceDisplayName(device.device_type)
			delete device.note
			delete device.supervisor_version
			delete device.uuid
			delete device.download_progress
			return device
		, [ 'ID', 'Name', 'Device Type', 'Is Online', 'IP Address', 'Application', 'Status', 'Last Seen' ]

	.catch(errors.handle)

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	patterns.remove 'device', program.parent.yes, (callback) ->
		resin.models.device.remove(id).then ->
			return callback()
		.catch(callback)
	, errors.handle

exports.identify = authHooks.failIfNotLoggedIn (uuid) ->
	resin.server.post(config.urls.identify, { uuid }, errors.handle)
