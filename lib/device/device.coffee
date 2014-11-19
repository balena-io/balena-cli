_ = require('lodash')
DEVICE_NAMES = require('./device-names.json')

exports.getDisplayName = (device) ->
	for key, value of DEVICE_NAMES
		if _.indexOf(value, device) isnt -1
			return key
	return 'Unknown'
