nplugm = require('nplugm')
_ = require('lodash')
capitano = require('capitano')

exports.register = (regex) ->
	nplugm.list(regex).map (plugin) ->
		command = require(plugin)
		command.plugin = true
		return capitano.command(command) if not _.isArray(command)
		return _.each(command, capitano.command)
	.catch (error) ->
		console.error(error.message)
