url = require('url')
_ = require('lodash')
resin = require('../resin')

exports.formatLongString = (string, n) ->
	return string if not n?
	splitRegexp = new RegExp(".{1,#{n}}", 'g')
	splittedString = string.match(splitRegexp)
	return splittedString.join('\n')

exports.isDeviceUUIDValid = (uuid, callback) ->
	resin.models.device.getAll (error, devices) ->
		return callback?(error) if error?
		uuidExists = _.findWhere(devices, { uuid })?
		return callback(null, uuidExists)

exports.constructRemoteUrl = (base, path, query) ->
	if not _.isEmpty(query)
		formattedQuery = url.format({ query })
		path = url.resolve(path, formattedQuery)

	return url.resolve(base, path)
