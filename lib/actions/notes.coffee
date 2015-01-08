async = require('async')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')
helpers = require('../helpers/helpers')
resin = require('resin-sdk')

exports.set = permissions.user (params, options) ->
	if not options.device?
		errors.handle(new Error('You have to specify a device'))

	async.waterfall([

		(callback) ->
			if not params.note?
				helpers.readStdin(callback)
			return callback(null, params.note)

		(note, callback) ->
			resin.models.device.note(options.device, note, callback)

	], errors.handle)
