_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.create = permissions.user (params, options, done) ->
	async.waterfall([

		(callback) ->
			deviceType = options.type

			if deviceType?
				return callback(null, deviceType)
			else
				deviceTypes = resin.models.device.getSupportedDeviceTypes()
				ui.widgets.select('Select a type', deviceTypes, callback)

		(type, callback) ->
			resin.models.application.create(params.name, type, callback)

	], done)

exports.list = permissions.user (params, options, done) ->
	resin.models.application.getAll (error, applications) ->
		return done(error) if error?
		console.log ui.widgets.table.horizontal applications, [
			'ID'
			'Name'
			'Device Display Name'
			'Online Devices'
			'Devices Length'
		]
		return done()

exports.info = permissions.user (params, options, done) ->
	resin.models.application.get params.id, (error, application) ->
		return done(error) if error?
		console.log ui.widgets.table.vertical application, [
			'ID'
			'Name'
			'Device Display Name'
			'Git Repository'
			'Commit'
		]
		return done()

exports.restart = permissions.user (params, options, done) ->
	resin.models.application.restart(params.id, done)

exports.remove = permissions.user (params, options, done) ->
	ui.patterns.remove 'application', options.yes, (callback) ->
		resin.models.application.remove(params.id, callback)
	, done

exports.init = permissions.user (params, options, done) ->

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

	], done
