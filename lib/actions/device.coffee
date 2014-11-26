resin = require('../resin')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn (applicationId) ->
	resin.models.device.getAll applicationId, (error, devices) ->
		resin.errors.handle(error) if error?

		resin.log.out resin.ui.widgets.table.horizontal devices, (device) ->
			device.application = device.application[0].app_name
			device.device_type = resin.device.getDisplayName(device.device_type)
			delete device.note
			delete device.supervisor_version
			delete device.uuid
			delete device.download_progress
			return device
		, [ 'ID', 'Name', 'Device Type', 'Is Online', 'IP Address', 'Application', 'Status', 'Last Seen' ]

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	resin.ui.patterns.remove 'device', program.parent.yes, (callback) ->
		resin.models.device.remove(id, callback)
	, resin.errors.handle

exports.identify = authHooks.failIfNotLoggedIn (uuid) ->
	resin.models.device.identify uuid, (error) ->
		resin.errors.handle(error) if error?
