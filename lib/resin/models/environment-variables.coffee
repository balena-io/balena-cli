pine = require('./_pine')
errors = require('../_errors/errors')

# Get all environment variables by application
#
# @param {String, Number} applicationId application id
# @param {Function} callback callback(error, environmentVariables)
#
# @throw {NotFound} Will throw if no environment variable was found
#
# @example Get all environment variables by application
#		resin.models.environmentVariables.getAll (error, environmentVariables) ->
#			throw error if error?
#			console.log(environmentVariables)
#
exports.getAllByApplication = (applicationId, callback) ->
	return pine.get
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

# Create an environment variable for an application
#
# @param {String, Number} applicationId application id
# @param {String} name environment variable name
# @param {String} value environment variable value
# @param {Function} callback callback(error)
#
# @example Create an environment variable
#		resin.models.environmentVariables.create 91, 'EDITOR', 'vim', (error) ->
#			throw error if error?
#
exports.create = (applicationId, name, value, callback) ->
	return pine.post
		resource: 'environment_variable'
		data:
			name: name
			value: value
			application: applicationId

	.then ->
		return callback()

	.catch (error) ->
		return callback(error)

# Update an environment variable value from an application
#
# @param {String, Number} applicationId application id
# @param {String} value environment variable value
# @param {Function} callback callback(error)
#
# @example Update an environment variable
#		resin.models.environmentVariables.update 317, 'vim', (error) ->
#			throw error if error?
#
exports.update = (id, value, callback) ->
	return pine.patch
		resource: 'environment_variable'
		id: id
		data:
			value: value

	.then ->
		return callback()

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
	return pine.delete
		resource: 'environment_variable'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)
