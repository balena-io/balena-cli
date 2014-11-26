resin = require('../resin')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn (applicationId) ->
	resin.models.device.getAll(applicationId).then (devices) ->

		resin.log.out resin.ui.widgets.table.horizontal devices, (device) ->
			device.application = device.application[0].app_name
			device.device_type = resin.device.getDisplayName(device.device_type)
			delete device.note
			delete device.supervisor_version
			delete device.uuid
			delete device.download_progress
			return device
		, [ 'ID', 'Name', 'Device Type', 'Is Online', 'IP Address', 'Application', 'Status', 'Last Seen' ]

	.catch(resin.errors.handle)

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	resin.ui.patterns.remove 'device', program.parent.yes, (callback) ->
		resin.models.device.remove(id).then ->
			return callback()
		.catch(callback)
	, resin.errors.handle

exports.identify = authHooks.failIfNotLoggedIn (uuid) ->
	resin.server.post(resin.config.urls.identify, { uuid }, resin.errors.handle)
