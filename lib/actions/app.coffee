_ = require('lodash')
async = require('async')
gitCli = require('git-cli')
resin = require('../resin')
ui = require('../ui')
log = require('../log/log')
errors = require('../errors/errors')
permissions = require('../permissions/permissions')

exports.create = permissions.user (params, options) ->
	async.waterfall [

		(callback) ->
			deviceType = options.type

			if deviceType?
				return callback(null, deviceType)
			else
				deviceTypes = resin.models.device.getSupportedDeviceTypes()
				ui.widgets.select('Select a type', deviceTypes, callback)

		(type, callback) ->

			# TODO: Currently returns 'unknown'.
			# Maybe we should break or handle better?
			slugifiedType = resin.models.device.getDeviceSlug(type)

			resin.models.application.create(params.name, slugifiedType, callback)

	], errors.handle

exports.list = permissions.user ->
	resin.models.application.getAll (error, applications) ->
		errors.handle(error) if error?

		log.out ui.widgets.table.horizontal applications, (application) ->
			application.device_type = application.device_display_name
			application.all_devices = application.devices_length
			return application
		, [ 'ID', 'Name', 'Device Type', 'Online Devices', 'All Devices' ]

exports.info = permissions.user (params) ->
	resin.models.application.get params.id, (error, application) ->
		errors.handle(error) if error?

		log.out ui.widgets.table.vertical application, (application) ->
			application.device_type = application.device_display_name
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

exports.restart = permissions.user (params) ->
	resin.models.application.restart params.id, (error) ->
		errors.handle(error) if error?

exports.remove = permissions.user (params, options) ->
	ui.patterns.remove 'application', options.yes, (callback) ->
		resin.models.application.remove(params.id, callback)
	, errors.handle

exports.init = permissions.user (params) ->

	currentDirectory = process.cwd()

	async.waterfall [

		(callback) ->
			resin.vcs.isResinProject(currentDirectory, callback)

		(isResinProject, callback) ->
			if isResinProject
				error = new Error('Project is already a resin application.')
				return callback(error)
			return callback()

		(callback) ->
			resin.models.application.get(params.id, callback)

		(application, callback) ->
			resin.vcs.initProjectWithApplication(application, currentDirectory, callback)

	], (error) ->
		errors.handle(error) if error?
