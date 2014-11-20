server = require('../server/server')
authHooks = require('../hooks/auth')
table = require('../table/table')
config = require('../config')

exports.list = authHooks.failIfNotLoggedIn ->
	server.get config.urls.keys, (error, response, keys) ->
		throw error if error?
		console.log table.horizontal keys, (key) ->
			delete key.public_key
			return key
		, [ 'ID', 'Title' ]
