Promise = require('bluebird')
canvas = require('./_canvas')

exports.getAll = (applicationId) ->
	return canvas.get
		resource: 'environment_variable'
		options:
			filter:
				application: applicationId
			orderby: 'name asc'

	.then (environmentVariables) ->
		if not environmentVariables?
			return Promise.reject(new Error('Not found'))
		return environmentVariables

exports.remove = (id) ->
	return canvas.delete
		resource: 'environment_variable'
		id: id
