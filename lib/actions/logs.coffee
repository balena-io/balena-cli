resin = require('resin-sdk')
permissions = require('../permissions/permissions')
log = require('../log/log')
errors = require('../errors/errors')

LOGS_HISTORY_COUNT = 200

exports.logs = permissions.user (params, options) ->

	resin.logs.subscribe params.uuid, {
		history: options.num or LOGS_HISTORY_COUNT
		tail: options.tail
	}, (error, message) ->
		errors.handle(error) if error?
		log.array(message, log.out)
