_ = require('lodash')
cliff = require('cliff')
server = require('../server/server')
device = require('../device/device')
applicationModel = require('../models/application')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn ->

	applicationModel.getAll().then (applications) ->

		applications = _.map applications, (application) ->
			return {
				ID: application.id
				Name: application.app_name
				'Device Type': device.getDisplayName(application.device_type)
				'Online Devices': _.where(application.device, is_online: 1).length
				'All Devices': application.device?.length or 0
			}

		console.log cliff.stringifyObjectRows(applications, _.keys _.first applications)
