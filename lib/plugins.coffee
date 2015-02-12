async = require('async')
npm = require('npm')
nplugm = require('nplugm')
_ = require('lodash')
_.str = require('underscore.string')
capitano = require('capitano')

registerPlugin = (plugin) ->
	return capitano.command(plugin) if not _.isArray(plugin)
	return _.each(plugin, capitano.command)

exports.register = (glob, callback) ->
	nplugm.load glob, (error, plugin) ->
		return console.error(error.message) if error?
		registerPlugin(plugin.require())
	, callback

exports.install = (name, callback) ->
	async.waterfall [

		(callback) ->
			npm.load(loglevel: 'silent', callback)

		(data, callback) ->

			# TODO: This action outputs installation information that cannot
			# be quieted neither with --quiet nor --silent:
			# https://github.com/npm/npm/issues/2040
			npm.commands.install([ name ], callback)

		(installedModules, modules, lite, callback) ->
			installedModules = _.map(installedModules, _.first)
			return callback(null, installedModules)

	], (error, installedModules) ->
		return callback(null, installedModules) if not error?

		if error.code is 'E404'
			error.message = "Plugin not found: #{params.name}"

		return callback(error) if error?

exports.remove = (name, callback) ->
	async.waterfall([

		(callback) ->
			npm.load(loglevel: 'silent', callback)

		(data, callback) ->
			npm.commands.uninstall([ name ], callback)

		(uninstalledPlugins, callback) ->
			if _.isEmpty(uninstalledPlugins)
				return callback(new Error("Plugin not found: #{name}"))
			return callback(null, _.first(uninstalledPlugins))

	], callback)

exports.list = (prefix, callback) ->
	async.waterfall([

		(callback) ->
			npm.load
				depth: 0
				parseable: true
			, callback

		(data, callback) ->
			npm.commands.list([], true, callback)

		(data, lite, callback) ->
			plugins = _.filter _.values(data.dependencies), (plugin) ->

				# TODO: Use node-glob
				return _.str.startsWith(plugin.name, prefix)

			return callback(null, plugins)

	], callback)
