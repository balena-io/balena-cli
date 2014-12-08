canvas = require('./_canvas')
errors = require('../errors/errors')

# Get all environment variables by application
#
# @param {String, Number} applicationId application id
# @param {Function} callback callback(error, environmentVariables)
#
# @throw {NotFound} Will throw if no environment variable was found
#
# @todo Rename this to getAllByApplication
#
# @example Get all environment variables by application
#		resin.models.environmentVariables.getAll (error, environmentVariables) ->
#			throw error if error?
#			console.log(environmentVariables)
#
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

# Remove environment variable
#
# @param {String, Number} id environment variable id
# @param {Function} callback callback(error)
#
# @example Remove environment variable
#		resin.models.environmentVariables.remove 51, (error) ->
#			throw error if error?
#
exports.remove = (id, callback) ->
	return canvas.delete
		resource: 'environment_variable'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)
