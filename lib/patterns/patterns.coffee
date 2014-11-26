async = require('async')
resin = require('../resin')

exports.remove = (name, confirmAttribute, deleteFunction, outerCallback) ->
	async.waterfall([

		(callback) ->
			if confirmAttribute
				return callback(null, true)

			resin.ui.widgets.confirmRemoval(name, callback)

		(confirmed, callback) ->
			return callback() if not confirmed
			deleteFunction(callback)

	], outerCallback)
