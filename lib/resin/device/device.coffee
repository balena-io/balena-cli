_ = require('lodash')

# TODO: This should be fetch from the server
DEVICES = require('./device-data.json')

# Get display name for a device
#
# For a list of supported devices, see getSupportedDevices()
#
# @param {String} device device name
# @return {String} device display name or 'Unknown'
#
# @example Get display name
#		console.log resin.device.getDisplayName('raspberry-pi') # Raspberry Pi
#		console.log resin.device.getDisplayName('rpi') # Raspberry Pi
#
exports.getDisplayName = (device) ->
	if _.indexOf(exports.getSupportedDevices(), device) isnt -1
		return device

	for key, value of DEVICES
		if _.indexOf(value.names, device) isnt -1
			return key
	return 'Unknown'

# TODO: Use _.slugify

# Get device slug
#
# @param {String} device device name
# @return {String} device slug or 'unknown'
#
# @example Get device slug
#		console.log resin.device.getDeviceSlug('Raspberry Pi') # raspberry-pi
#
exports.getDeviceSlug = (device) ->
	displayName = exports.getDisplayName(device)
	return DEVICES[displayName]?.slug or 'unknown'

# Get a list of supported devices
#
# @return {Array<String>} a list of all supported devices, by their display names
#
# @example Get all supported devices
#		devices = resin.device.getSupportedDevices()
#		console.log(devices)
#
exports.getSupportedDevices = ->
	return _.keys(DEVICES)
