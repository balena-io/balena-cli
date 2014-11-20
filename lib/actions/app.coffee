_ = require('lodash')
device = require('../device/device')
table = require('../table/table')
server = require('../server/server')
applicationModel = require('../models/application')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn ->
	applicationModel.getAll().then (applications) ->

		console.log table.horizontal applications, (application) ->
			application.device_type = device.getDisplayName(application.device_type)
			application['Online Devices'] = _.where(application.device, is_online: 1).length
			application['All Devices'] = application.device?.length or 0
			delete application.git_repository
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Online Devices', 'All Devices' ]

	.catch (error) ->
		throw error

exports.info = authHooks.failIfNotLoggedIn (id) ->
	applicationModel.get(id).then (application) ->

		console.log table.vertical application, (application) ->
			application.device_type = device.getDisplayName(application.device_type)
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

	.catch (error) ->
		throw error

exports.restart = authHooks.failIfNotLoggedIn (id) ->
	server.post "/application/#{id}/restart", (error) ->
		throw error if error?
