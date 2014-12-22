# Generate os cache name
#
# It generates an unique name for a certain instance of the os
# with id and connection params embedded in the filename.
#
# @param {String, Number} id application id
# @param {Object} connectionParams connection parameters
# @option connectionParams {String} network network type
# @option connectionParams {String} wifiKey wifi key
# @option connectionParams {String} wifiSsid wifi ssid
#
# @return {String} os cache name
#
# @note For security reasons, the wifiSsid is omitted from the filename
# @note The original filename extension (*.zip in this case) is lost in the renaming process
#
# @example Generate cache name for ethernet os
#		result = resin.os.generateCacheName(51, { network: 'ethernet' })
#		console.log(result)
#		# 51-ethernet-1418040928724
#
# @example Generate cache name for wifi os
#		result = resin.os.generateCacheName(51, {
#			network: 'wifi'
#			wifiKey: 'MyWifi'
#			wifiSsid: 'secret'
#		})
#		console.log(result)
#		# 51-wifi-MyWifi-1418040928724
#
exports.generateCacheName = (id, connectionParams) ->
	result = "#{id}-#{connectionParams.network}"

	if connectionParams.wifiSsid?
		result += "-#{connectionParams.wifiSsid}"

	return "#{result}-#{Date.now()}"
