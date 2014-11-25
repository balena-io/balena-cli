_ = require('lodash')
isOnline = require('is-online')

CONNECTION_PARAMETERS = [
	'network'
	'wifiEssid'
	'wifiKey'
]

# A wrapper around isOnline in order
# to be able to stub it with Sinon
exports.isOnline = isOnline

validateEthernetConnectionParameters = (parameters = {}) ->
	return if not parameters.wifiEssid? and not parameters.wifiKey?
	return new Error('You can only use wifi options if network is wifi')

validateWifiConnectionParameters = (parameters = {}) ->
	return if parameters.wifiEssid? and parameters.wifiKey?
	return new Error('You have to provide an essid and key if network is wifi')

exports.parseConnectionParameters = (parameters = {}, callback) ->
	parameters = _.pick(parameters, CONNECTION_PARAMETERS)

	if parameters.network is 'ethernet'
		error = validateEthernetConnectionParameters(parameters)
		return callback(error, parameters)

	else if parameters.network is 'wifi'
		error = validateWifiConnectionParameters(parameters)
		return callback(error, parameters)

	return callback(new Error('Unknown network type'))
