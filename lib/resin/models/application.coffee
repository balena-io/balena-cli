_ = require('lodash-contrib')
pine = require('./_pine')
errors = require('../_errors/errors')
server = require('../server/server')
settings = require('../settings')

# Get all applications
#
# @param {Function} callback callback(error, applications)
#
# @throw {NotAny} Will throw if no applications were found
#
# @example Get all applications
#		resin.models.application.getAll (error, applications) ->
#			throw error if error?
#			console.log(applications)
#
exports.getAll = (callback) ->
	return pine.get
		resource: 'application'
		options:
			orderby: 'app_name asc'
			expand: 'device'
	.then (applications) ->
		if _.isEmpty(applications)
			return callback(new errors.NotAny('applications'))

		return callback(null, applications)

	.catch (error) ->
		return callback(error)

# Get a single application
#
# @param {String, Number} id application id
# @param {Function} callback callback(error, application)
#
# @throw {NotFound} Will throw if application was not found
#
# @example Find application
#		resin.models.application.get 51, (error, application) ->
#			throw error if error?
#			console.log(application)
#
exports.get = (id, callback) ->
	return pine.get
		resource: 'application'
		id: id

	.then (application) ->
		if not application?
			return callback(new errors.NotFound("application #{id}"))

		return callback(null, application)

	.catch (error) ->
		return callback(error)

# Create an application
#
# @param {String} name application name
# @param {String} deviceType device type (slug form)
# @param {Function} callback callback(error, id)
#
# @throw {NotFound} Will throw if the request doesn't returns an id
#
# @example Create an application
#		resin.models.application.create 'My App', 'raspberry-pi', (error, id) ->
#			throw error if error?
#			console.log(id)
#
exports.create = (name, deviceType, callback) ->
	return pine.post
		resource: 'application'
		data:
			app_name: name
			device_type: deviceType

	.then (res) ->
		id = res?.id

		if not id?
			return callback(new errors.NotFound('created application id'))

		return callback(null, id)

	.catch (error) ->
		return callback(error)

# Remove application
#
# @param {String, Number} id application id
# @param {Function} callback callback(error)
#
# @example Remove application
#		resin.models.application.remove 51, (error) ->
#			throw error if error?
#
exports.remove = (id, callback) ->
	return pine.delete
		resource: 'application'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)

# Restart application
#
# @param {String, Number} id application id
# @param {Function} callback callback(error)
#
# @example Restart application
#		resin.models.application.restart 51, (error) ->
#			throw error if error?
#
exports.restart = (id, callback) ->
	url = _.template(settings.get('urls.applicationRestart'), { id })
	server.post(url, _.unary(callback))
