_ = require('lodash')
Promise = require('bluebird')
canvas = require('./_canvas')

SYSTEM_VAR_REGEX = /^RESIN_/

isSystemVariable = (environmentVariable) ->
	SYSTEM_VAR_REGEX.test(environmentVariable.name)

exports.getAll = (applicationId) ->
	return canvas.get
		resource: 'environment_variable'
		options:
			filter:
				application: applicationId
			orderby: 'name asc'

	.then (environmentVariables) =>
		if not environmentVariables?
			return Promise.reject(new Error('Not found'))

		return _.reject(environmentVariables, isSystemVariable)
