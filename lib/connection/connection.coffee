_ = require('lodash')

CONNECTION_PARAMETERS = [
	'network'
	'wifiSsid'
	'wifiKey'
]

validateEthernetConnectionParameters = (parameters = {}) ->
	return if not parameters.wifiSsid? and not parameters.wifiKey?
	return new Error('You can only use wifi options if network is wifi')

validateWifiConnectionParameters = (parameters = {}) ->
	return if parameters.wifiSsid? and parameters.wifiKey?
	return new Error('You have to provide an ssid and key if network is wifi')

exports.parseConnectionParameters = (parameters = {}, callback) ->
	parameters = _.pick(parameters, CONNECTION_PARAMETERS)
	parameters = _.omit parameters, (value) ->
		return not value?

	if parameters.network is 'ethernet'
		error = validateEthernetConnectionParameters(parameters)
		return callback(error, parameters)

	else if parameters.network is 'wifi'
		error = validateWifiConnectionParameters(parameters)
		return callback(error, parameters)

	return callback(new Error('Unknown network type'))
