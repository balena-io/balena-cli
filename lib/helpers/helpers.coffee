_ = require('lodash')

# TODO: Find a sane way to test streams
exports.readStdin = (callback) ->
	stdin = process.stdin

	stdin.resume()
	stdin.setEncoding('utf8')

	result = []

	stdin.on('error', callback)

	stdin.on 'data', (chunk) ->
		result.push(chunk)

	stdin.on 'end', ->
		result = result.join()
		return callback(null, result)

exports.parseCredentials = (credentials, callback) ->
	result = credentials.split(':')

	if result.length isnt 2
		error = new Error('Invalid credentials')
		return callback?(error)

	callback? null,
		username: _.first(result)
		password: _.last(result)
