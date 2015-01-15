_ = require('lodash-contrib')
async = require('async')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.list = permissions.user (params, options, done) ->
	resin.models.device.getAllByApplication options.application, (error, devices) ->
		return done(error) if error?
		console.log ui.widgets.table.horizontal devices, [
			'ID'
			'Name'
			'Device Display Name'
			'Is Online'
			'Application Name'
			'Status'
			'Last Seen'
		]

		return done()

exports.info = permissions.user (params, options, done) ->
	resin.models.device.get params.id, (error, device) ->
		return done(error) if error?
		console.log ui.widgets.table.vertical device, [
			'ID'
			'Name'
			'Device Display Name'
			'Is Online'
			'IP Address'
			'Application Name'
			'Status'
			'Last Seen'
			'UUID'
			'Commit'
			'Supervisor Version'
			'Is Web Accessible'
			'Note'
		]

		return done()

exports.remove = permissions.user (params, options, done) ->
	ui.patterns.remove 'device', options.yes, (callback) ->
		resin.models.device.remove(params.id, callback)
	, done

exports.identify = permissions.user (params, options, done) ->
	resin.models.device.identify(params.uuid, done)

exports.rename = permissions.user (params, options, done) ->
	async.waterfall [

		(callback) ->
			if not _.isEmpty(params.name)
				return callback(null, params.name)
			ui.widgets.ask('How do you want to name this device?', callback)

		(name, callback) ->
			resin.models.device.rename(params.id, name, callback)

	], done

exports.supported = permissions.user ->
	devices = resin.models.device.getSupportedDeviceTypes()
	_.each(devices, _.unary(console.log))
