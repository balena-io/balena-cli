_ = require('lodash')
async = require('async')
path = require('path')
fs = require('fs')
resin = require('../resin')

exports.use = (plugin) ->
	if not _.isFunction(plugin)
		throw new Error('Plugin should be a function')

	plugin.call(null, resin)

exports.loadPlugin = (pluginPath, callback) ->
	pluginPackageJSON = path.join(pluginPath, 'package.json')

	async.waterfall([

		(callback) ->
			fs.exists pluginPackageJSON, (exists) ->
				error = new Error("#{pluginPackageJSON} doesn't exist")
				return callback(if not exists then error)

		(callback) ->
			fs.stat(pluginPackageJSON, callback)

		(stats, callback) ->
			error = new Error("#{pluginPackageJSON} is not a file")
			return callback(if not stats.isFile() then error)

		(callback) ->
			try
				packageJSON = require(pluginPackageJSON)
			catch error
				return callback(error)

			if not _.isObject(packageJSON)
				error = new Error('package.json is not a valid JSON file')
				return callback(error)

			if not packageJSON.main?
				error = new Error('package.json is missing main')
				return callback(error)

			mainFilePath = path.join(pluginPath, packageJSON.main)

			try
				mainFile = require(mainFilePath)
			catch error
				return callback(error)

			if not _.isFunction(mainFile)
				return callback(new Error('Entry point should be a function'))

			return callback(null, mainFile)

	], callback)

isDirectory = (directory, callback) ->
	fs.stat directory, (error, stats) ->
		return callback(false) if error?
		return callback(stats.isDirectory())

exports.readPluginsDirectory = (directory, callback) ->

	async.waterfall([

		(callback) ->
			fs.readdir(directory, callback)

		(plugins, callback) ->
			fullPathPlugins = _.map plugins, (plugin) ->
				return path.join(directory, plugin)

			async.filter fullPathPlugins, isDirectory, (results) ->
				return callback(null, results)

	], callback)
