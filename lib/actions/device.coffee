resin = require('../resin')
cli = require('../cli/cli')

exports.list = (applicationId) ->
	resin.models.device.getAllByApplication applicationId, (error, devices) ->
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

exports.info = (deviceId) ->
	resin.models.device.get deviceId, (error, device) ->
		resin.errors.handle(error) if error?

		resin.log.out resin.ui.widgets.table.vertical device, (device) ->
			device.device_type = resin.device.getDisplayName(device.device_type)
			device.application = device.application[0].app_name
			return device
		, [
			'ID'
			'Name'
			'Device Type'
			'Is Online'
			'IP Address'
			'Application'
			'Status'
			'Last Seen'
			'UUID'
			'Commit'
			'Supervisor Version'
			'Is Web Accessible'
			'Note'
		]

exports.remove = (id) ->
	confirmArgument = cli.getArgument('yes')
	resin.ui.patterns.remove 'device', confirmArgument, (callback) ->
		resin.models.device.remove(id, callback)
	, resin.errors.handle

exports.identify = (uuid) ->
	resin.models.device.identify uuid, (error) ->
		resin.errors.handle(error) if error?
