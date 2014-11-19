_ = require('lodash')
cliff = require('cliff')
server = require('../server/server')
device = require('../device/device')
table = require('../table/table')
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

exports.info = authHooks.failIfNotLoggedIn (id) ->
	applicationModel.get(id).then (application) ->

		console.log("ID: #{application.id}")
		console.log("Name: #{application.app_name}")
		console.log("Device Type: #{device.getDisplayName(application.device_type)}")
		console.log("Git Repository: #{application.git_repository}")
		console.log("Commit: #{application.commit}")

	.catch (error) ->
		throw error
