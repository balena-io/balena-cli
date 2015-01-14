_ = require('lodash')
fs = require('fs')
path = require('path')
yeoman = require('yeoman-environment')
glob = require('glob')

exports.getNpmPaths = ->
	return yeoman.createEnv().getNpmPaths()

exports.getPluginsPathsByGlob = (nameGlob) ->

	if not nameGlob?
		throw new Error('Missing glob')

	if not _.isString(nameGlob)
		throw new Error('Invalid glob')

	npmPaths = exports.getNpmPaths()
	result = []

	for npmPath in npmPaths
		foundModules = glob.sync(nameGlob, cwd: npmPath)
		foundModules = _.map foundModules, (foundModule) ->
			return path.join(npmPath, foundModule)

		result = result.concat(foundModules)

	return result

exports.getPluginMeta = (pluginPath) ->
	pluginPackageJSONPath = path.join(pluginPath, 'package.json')

	if not fs.existsSync(pluginPackageJSONPath)
		throw new Error("Missing or invalid plugin: #{pluginPath}")

	pluginPackageJSON = fs.readFileSync pluginPackageJSONPath,
		encoding: 'utf8'

	try
		meta = JSON.parse(pluginPackageJSON)
	catch
		throw new Error("Invalid package.json: #{pluginPackageJSONPath}")

	return meta
