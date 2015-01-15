_ = require('lodash')
resin = require('resin-sdk')
permissions = require('../permissions/permissions')

LOGS_HISTORY_COUNT = 200

exports.logs = permissions.user (params, options, done) ->

	resin.logs.subscribe params.uuid, {
		history: options.num or LOGS_HISTORY_COUNT
		tail: options.tail
	}, (error, message) ->
		return done(error) if error?
		_.each(message, console.log)
		return done()
