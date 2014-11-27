_ = require('lodash')
resin = require('../resin')

exports.use = (plugin) ->
	if not _.isFunction(plugin)
		throw new Error('Plugin should be a function')

	plugin.call(null, resin)
