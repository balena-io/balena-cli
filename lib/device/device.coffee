_ = require('lodash')
DEVICES = require('./device-data.json')

exports.getDisplayName = (device) ->
	for key, value of DEVICES
		if _.indexOf(value.names, device) isnt -1
			return key
	return 'Unknown'

exports.getDeviceSlug = (device) ->
	displayName = exports.getDisplayName(device)
	return DEVICES[displayName]?.slug or 'unknown'

exports.getSupportedDevices = ->
	return _.keys(DEVICES)
