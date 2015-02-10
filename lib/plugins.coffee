nplugm = require('nplugm')
_ = require('lodash')
capitano = require('capitano')

registerPlugin = (plugin) ->
	return capitano.command(plugin) if not _.isArray(plugin)
	return _.each(plugin, capitano.command)

exports.register = (glob, callback) ->
	nplugm.load glob, (error, plugin) ->
		return console.error(error.message) if error?
		registerPlugin(plugin.require())
	, callback
