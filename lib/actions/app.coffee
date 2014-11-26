_ = require('lodash')
async = require('async')
resin = require('../resin')
authHooks = require('../hooks/auth')

exports.create = authHooks.failIfNotLoggedIn (name, program) ->
	async.waterfall [

		(callback) ->
			deviceType = program.parent.type

			if deviceType?
				return callback(null, deviceType)
			else
				deviceTypes = resin.device.getSupportedDevices()
				resin.ui.widgets.select('Select a type', deviceTypes, callback)

		(type, callback) ->

			# TODO: Currently returns 'unknown'.
			# Maybe we should break or handle better?
			slugifiedType = resin.device.getDeviceSlug(type)

			resin.models.application.create(name, slugifiedType, callback)

	], resin.errors.handle

exports.list = authHooks.failIfNotLoggedIn ->
	resin.models.application.getAll (error, applications) ->
		resin.errors.handle(error) if error?

		resin.log.out resin.ui.widgets.table.horizontal applications, (application) ->
			application.device_type = resin.device.getDisplayName(application.device_type)
			application['Online Devices'] = _.where(application.device, is_online: 1).length
			application['All Devices'] = application.device?.length or 0
			delete application.git_repository
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Online Devices', 'All Devices' ]

exports.info = authHooks.failIfNotLoggedIn (id) ->
	resin.models.application.get id, (error, application) ->
		resin.errors.handle(error) if error?

		resin.log.out resin.ui.widgets.table.vertical application, (application) ->
			application.device_type = resin.device.getDisplayName(application.device_type)
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

exports.restart = authHooks.failIfNotLoggedIn (id) ->

	resin.models.application.restart id, (error) ->
		resin.errors.handle(error) if error?

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	resin.ui.patterns.remove 'application', program.parent.yes, (callback) ->
		resin.models.application.remove(id, callback)
	, resin.errors.handle
