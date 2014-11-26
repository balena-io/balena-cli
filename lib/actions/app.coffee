_ = require('lodash')
async = require('async')
device = require('../device/device')
table = require('../table/table')
errors = require('../errors/errors')
log = require('../log/log')
resin = require('../resin')
widgets = require('../widgets/widgets')
patterns = require('../patterns/patterns')
applicationModel = require('../models/application')
authHooks = require('../hooks/auth')
config = require('../config')

exports.create = authHooks.failIfNotLoggedIn (name, program) ->
	async.waterfall [

		(callback) ->
			deviceType = program.parent.type

			if deviceType?
				return callback(null, deviceType)
			else
				deviceTypes = device.getSupportedDevices()
				widgets.select('Select a type', deviceTypes, callback)

		(type, callback) ->

			# TODO: Currently returns 'unknown'.
			# Maybe we should break or handle better?
			slugifiedType = device.getDeviceSlug(type)

			applicationModel.create(name, slugifiedType).then ->
				return callback()
			.catch(callback)

	], errors.handle

exports.list = authHooks.failIfNotLoggedIn ->
	applicationModel.getAll().then (applications) ->

		log.out table.horizontal applications, (application) ->
			application.device_type = device.getDisplayName(application.device_type)
			application['Online Devices'] = _.where(application.device, is_online: 1).length
			application['All Devices'] = application.device?.length or 0
			delete application.git_repository
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Online Devices', 'All Devices' ]

	.catch(errors.handle)

exports.info = authHooks.failIfNotLoggedIn (id) ->
	applicationModel.get(id).then (application) ->

		log.out table.vertical application, (application) ->
			application.device_type = device.getDisplayName(application.device_type)
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

	.catch(errors.handle)

exports.restart = authHooks.failIfNotLoggedIn (id) ->

	# TODO: Move this URL to config
	resin.server.post("/application/#{id}/restart", errors.handle)

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	patterns.remove 'application', program.parent.yes, (callback) ->
		applicationModel.remove(id).then ->
			return callback()
		.catch(callback)
	, errors.handle
