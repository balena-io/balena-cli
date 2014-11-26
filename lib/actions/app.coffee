_ = require('lodash')
async = require('async')
resin = require('../resin')
widgets = require('../widgets/widgets')
patterns = require('../patterns/patterns')
authHooks = require('../hooks/auth')
config = require('../config')

exports.create = authHooks.failIfNotLoggedIn (name, program) ->
	async.waterfall [

		(callback) ->
			deviceType = program.parent.type

			if deviceType?
				return callback(null, deviceType)
			else
				deviceTypes = resin.device.getSupportedDevices()
				widgets.select('Select a type', deviceTypes, callback)

		(type, callback) ->

			# TODO: Currently returns 'unknown'.
			# Maybe we should break or handle better?
			slugifiedType = resin.device.getDeviceSlug(type)

			resin.models.application.create(name, slugifiedType).then ->
				return callback()
			.catch(callback)

	], resin.errors.handle

exports.list = authHooks.failIfNotLoggedIn ->
	resin.models.application.getAll().then (applications) ->

		resin.log.out widgets.table.horizontal applications, (application) ->
			application.device_type = resin.device.getDisplayName(application.device_type)
			application['Online Devices'] = _.where(application.device, is_online: 1).length
			application['All Devices'] = application.device?.length or 0
			delete application.git_repository
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Online Devices', 'All Devices' ]

	.catch(resin.errors.handle)

exports.info = authHooks.failIfNotLoggedIn (id) ->
	resin.models.application.get(id).then (application) ->

		resin.log.out widgets.table.vertical application, (application) ->
			application.device_type = resin.device.getDisplayName(application.device_type)
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

	.catch(resin.errors.handle)

exports.restart = authHooks.failIfNotLoggedIn (id) ->

	# TODO: Move this URL to config
	resin.server.post("/application/#{id}/restart", resin.errors.handle)

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	patterns.remove 'application', program.parent.yes, (callback) ->
		resin.models.application.remove(id).then ->
			return callback()
		.catch(callback)
	, resin.errors.handle
