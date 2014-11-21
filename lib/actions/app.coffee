_ = require('lodash')
async = require('async')
device = require('../device/device')
table = require('../table/table')
log = require('../log/log')
server = require('../server/server')
widgets = require('../widgets/widgets')
applicationModel = require('../models/application')
authHooks = require('../hooks/auth')
config = require('../config')

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

	.catch (error) ->
		throw error

exports.info = authHooks.failIfNotLoggedIn (id) ->
	applicationModel.get(id).then (application) ->

		log.out table.vertical application, (application) ->
			application.device_type = device.getDisplayName(application.device_type)
			delete application.device
			return application
		, [ 'ID', 'Name', 'Device Type', 'Git Repository', 'Commit' ]

	.catch (error) ->
		throw error

exports.restart = authHooks.failIfNotLoggedIn (id) ->

	# TODO: Move this URL to config
	server.post "/application/#{id}/restart", (error) ->
		throw error if error?

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	async.waterfall [

		(callback) ->
			if program.parent.yes
				return callback(null, true)

			widgets.confirmRemoval('application', callback)

		(confirmed, callback) ->
			return callback() if not confirmed

			applicationModel.remove(id).then ->
				return callback()
			.catch(callback)

	], (error) ->
		throw error if error?
