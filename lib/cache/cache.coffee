exports.generateCacheName = (id, connectionParams) ->
	result = "#{id}-#{connectionParams.network}"

	if connectionParams.wifiSsid?
		result += "-#{connectionParams.wifiSsid}"

	return "#{result}-#{Date.now()}"
