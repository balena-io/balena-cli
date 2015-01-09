_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
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

			# TODO: Currently returns 'unknown' if device is not recognised.
			# Maybe we should break or handle better?
			slugifiedType = resin.models.device.getDeviceSlug(type)

			resin.models.application.create(params.name, slugifiedType, callback)

	], errors.handle

exports.list = permissions.user ->
	resin.models.application.getAll errors.handleCallback (applications) ->
		log.out ui.widgets.table.horizontal applications, [
			'ID'
			'Name'
			'Device Display Name'
			'Online Devices'
			'Devices Length'
		]

exports.info = permissions.user (params) ->
	resin.models.application.get params.id, errors.handleCallback (application) ->
		log.out ui.widgets.table.vertical application, [
			'ID'
			'Name'
			'Device Display Name'
			'Git Repository'
			'Commit'
		]

exports.restart = permissions.user (params) ->
	resin.models.application.restart(params.id, _.unary(errors.handle))

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

	], errors.handle
