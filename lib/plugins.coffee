Nplugm = require('nplugm')
_ = require('lodash')
capitano = require('capitano')

nplugm = null

registerPlugin = (plugin) ->
	return capitano.command(plugin) if not _.isArray(plugin)
	return _.each(plugin, capitano.command)

exports.register = (prefix, callback) ->
	nplugm = new Nplugm(prefix)
	nplugm.list (error, plugins) ->
		return callback(error) if error?

		for plugin in plugins
			try
				registerPlugin(nplugm.require(plugin))
			catch error
				console.error(error.message)

		return callback()
