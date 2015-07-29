_ = require('lodash')
os = require('os')
path = require('path')

isWindows = ->
	return os.platform() is 'win32'

exports.shouldElevate = (error) ->
	return _.all [
		isWindows()
		error.code is 'EPERM' or error.code is 'EACCES'
	]

exports.run = (command) ->
	return if not isWindows()
	require('windosu').exec(command)
