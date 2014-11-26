_ = require('lodash')
canvas = require('./_canvas')
errors = require('../errors/errors')
server = require('../server/server')

exports.getAll = (callback) ->
	return canvas.get
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

exports.get = (id, callback) ->
	return canvas.get
		resource: 'application'
		id: id

	.then (application) ->
		if not application?
			return callback(new errors.NotFound("application #{id}"))

		return callback(null, application)

	.catch (error) ->
		return callback(error)

exports.create = (name, deviceType, callback) ->
	return canvas.post
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

exports.remove = (id, callback) ->
	return canvas.delete
		resource: 'application'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)

exports.restart = (id, callback) ->

	# TODO: Move this URL to config
	server.post("/application/#{id}/restart", callback)
