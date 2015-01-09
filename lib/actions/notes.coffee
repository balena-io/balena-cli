async = require('async')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')
helpers = require('../helpers/helpers')
resin = require('resin-sdk')

exports.set = permissions.user (params, options) ->
	async.waterfall([

		(callback) ->
			if not params.note?
				return helpers.readStdin(callback)
			return callback(null, params.note)

		(note, callback) ->
			resin.models.device.note(options.device, note, callback)

	], errors.handle)
