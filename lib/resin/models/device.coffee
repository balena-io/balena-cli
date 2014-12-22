pine = require('./_pine')
_ = require('lodash-contrib')
errors = require('../_errors/errors')
server = require('../_server/server')
settings = require('../settings')
DEVICES = require('./device-data.json')

# Get all devices
#
# @param {Function} callback callback(error, devices)
#
# @throw {NotAny} Will throw if no devices were found
#
# @example Get all devices
#		resin.models.devices.getAll (error, devices) ->
#			throw error if error?
#			console.log(devices)
#
exports.getAll = (callback) ->
	return pine.get
		resource: 'device'
		options:
			expand: 'application'
			orderby: 'name asc'
	.then (devices) ->
		if _.isEmpty(devices)
			return callback(new errors.NotAny('devices'))

		return callback(null, devices)

	.catch (error) ->
		return callback(error)

# Get all devices by application
#
# @param {String, Number} applicationId application id
# @param {Function} callback callback(error, devices)
#
# @throw {NotAny} Will throw if no devices were found
#
# @example Get all devices by application
#		resin.models.devices.getAllByApplication (error, devices) ->
#			throw error if error?
#			console.log(devices)
#
exports.getAllByApplication = (applicationId, callback) ->
	return pine.get
		resource: 'device'
		options:
			filter:
				application: applicationId
			expand: 'application'
			orderby: 'name asc'
	.then (devices) ->
		if _.isEmpty(devices)
			return callback(new errors.NotAny('devices'))

		return callback(null, devices)

	.catch (error) ->
		return callback(error)

# Get a single device
#
# @param {String, Number} id device id
# @param {Function} callback callback(error, device)
#
# @throw {NotFound} Will throw if device was not found
#
# @example Find device
#		resin.models.device.get 51, (error, device) ->
#			throw error if error?
#			console.log(device)
#
exports.get = (deviceId, callback) ->
	return pine.get
		resource: 'device'
		id: deviceId
		options:
			expand: 'application'

	.then (device) ->
		if not device?
			return callback(new errors.NotFound("device #{id}"))

		return callback(null, device)

	.catch (error) ->
		return callback(error)

# Remove device
#
# @param {String, Number} id device id
# @param {Function} callback callback(error)
#
# @example Remove device
#		resin.models.device.remove 51, (error) ->
#			throw error if error?
#
exports.remove = (id, callback) ->
	return pine.delete
		resource: 'device'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)

# Identify device
#
# @param {String} uuid device uuid
# @param {Function} callback callback(error)
#
# @example Identify device
#		resin.models.device.identify '23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a21369ac0f00db828', (error) ->
#			throw error if error?
#
exports.identify = (uuid, callback) ->
	server.post(settings.get('urls.identify'), { uuid }, _.unary(callback))

# Rename device
#
# @param {String, Number} id device id
# @param {String} name the device new name
# @param {Function} callback callback(error)
#
# @example Rename device
#		resin.models.device.rename 317, 'NewName', (error) ->
#			throw error if error?
#			console.log("Device has been renamed!")
#
exports.rename = (id, name, callback) ->
	return pine.patch
		resource: 'device'
		id: id
		data:
			name: name

	.then ->
		return callback()

	.catch (error) ->
		return callback(error)

# Get display name for a device
#
# For a list of supported devices, see getSupportedDeviceTypes()
#
# @param {String} device device name
# @return {String} device display name or 'Unknown'
#
# @example Get display name
#		console.log resin.models.device.getDisplayName('raspberry-pi') # Raspberry Pi
#		console.log resin.models.device.getDisplayName('rpi') # Raspberry Pi
#
exports.getDisplayName = (device) ->
	if _.indexOf(exports.getSupportedDeviceTypes(), device) isnt -1
		return device

	for key, value of DEVICES
		if _.indexOf(value.names, device) isnt -1
			return key
	return 'Unknown'

# Get device slug
#
# @param {String} device device name
# @return {String} device slug or 'unknown'
#
# @example Get device slug
#		console.log resin.models.device.getDeviceSlug('Raspberry Pi') # raspberry-pi
#
exports.getDeviceSlug = (device) ->
	displayName = exports.getDisplayName(device)
	return DEVICES[displayName]?.slug or 'unknown'

# Get a list of supported device types
#
# @return {Array<String>} a list of all supported devices, by their display names
#
# @example Get all supported devices
#		devices = resin.models.device.getSupportedDevicesTypes()
#		console.log(devices)
#
exports.getSupportedDeviceTypes = ->
	return _.keys(DEVICES)
