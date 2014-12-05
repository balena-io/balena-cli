_ = require('lodash-contrib')
fs = require('fs')
path = require('path')

class CliConf
	constructor: (@_options = {}) ->
		_.defaults @_options,
			configFileParse: JSON.parse
			encoding: 'utf8'

		@_data = @_options.default or {}

		# Ordering is important here. We give precendece
		# to local config over user config and defaults.
		@extendWithFile(@_getOptionWithKey('userConfig'))
		@extendWithFile(@_getLocalConfigPath())

	extendWithFile: (file) ->
		return if not fs.existsSync(file)
		fileContents = @_readFile(file)
		@extend(fileContents)

	set: (key, value) ->
		@_data[key] = value

	get: (key) ->
		return @_getKeyFromObject(@_data, key)

	has: (key) ->
		return _.has(@_data, key)

	extend: (objects...) ->
		return _.extend(@_data, objects...)

	isEmpty: ->
		return _.isEmpty(@_data)

	parse: (input) ->
		return @_options.configFileParse(input)

	# Private functions

	_getKeyFromObject: (object, key) ->
		return if not key?
		return _.getPath(object, key)

	_getOptionKey: (key) ->
		return @_getKeyFromObject(@_options.keys, key)

	_getOptionWithKey: (key) ->
		get = _.bind(@get, this)
		getOptionKey = _.bind(@_getOptionKey, this)
		return _.compose(get, getOptionKey)(key)

	_getLocalConfigPath: ->
		localConfigFile = @_getOptionWithKey('localConfig')
		return if not localConfigFile?
		return path.join(process.cwd(), localConfigFile)

	_readFile: (file) ->
		fileContents = fs.readFileSync(file, @_options.encoding)
		return @parse(fileContents)

module.exports = CliConf
