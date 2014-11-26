canvas = require('./_canvas')
errors = require('../errors/errors')

exports.getAll = (applicationId, callback) ->
	return canvas.get
		resource: 'environment_variable'
		options:
			filter:
				application: applicationId
			orderby: 'name asc'

	.then (environmentVariables) ->
		if not environmentVariables?
			return callback(new errors.NotFound('environment variables'))

		return callback(null, environmentVariables)

	.catch (error) ->
		return callback(error)

exports.remove = (id, callback) ->
	return canvas.delete
		resource: 'environment_variable'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)
