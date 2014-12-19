pine = require('./_pine')
_ = require('lodash-contrib')
errors = require('../errors/errors')
server = require('../server/server')
settings = require('../settings')

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
