Promise = require('bluebird')
form = require('resin-cli-form')

exports.selectDeviceType = ->
	return form.ask
		message: 'Device Type'
		type: 'list'
		choices: [

			# Lock to specific devices until we support
			# the rest with device specs.
			'Raspberry Pi'
			'Raspberry Pi 2'
			'BeagleBone Black'
		]

exports.confirm = (yesOption, message) ->
	Promise.try ->
		return true if yesOption
		return form.ask
			message: message
			type: 'confirm'
			default: false
