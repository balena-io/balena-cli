_ = require('lodash')
resin = require('../resin')

exports.isDeviceUUIDValid = (uuid, callback) ->
	resin.models.device.getAll (error, devices) ->
		return callback?(error) if error?
		uuidExists = _.findWhere(devices, { uuid })?
		return callback(null, uuidExists)
