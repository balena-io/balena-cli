nplugm = require('nplugm')
_ = require('lodash')
capitano = require('capitano')
patterns = require('./patterns')

exports.register = (regex) ->
	nplugm.list(regex).map (plugin) ->
		command = require(plugin)
		return capitano.command(command) if not _.isArray(command)
		return _.each(command, capitano.command)
	.catch (error) ->
		patterns.printErrorMessage(error.message)
