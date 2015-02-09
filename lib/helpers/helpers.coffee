getStdin = require('get-stdin')

exports.readStdin = (callback) ->
	getStdin (result) ->
		return callback(null, result)
