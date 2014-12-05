canvas = require('./_canvas')
_ = require('lodash')
errors = require('../errors/errors')
server = require('../server/server')
settings = require('../settings')

exports.getAll = (callback) ->
	return canvas.get
		resource: 'device'
		options:
			expand: 'application'
			orderby: 'name asc'
	.then (devices) ->
		if _.isEmpty(devices)
			return callback(new errors.NotAny('devices'))

		return callback(null, devices)

	.catch (error) ->
		return callback(error)

exports.getAllByApplication = (applicationId, callback) ->
	return canvas.get
		resource: 'device'
		options:
			filter:
				application: applicationId
			expand: 'application'
			orderby: 'name asc'
	.then (devices) ->
		if _.isEmpty(devices)
			return callback(new errors.NotAny('devices'))

		return callback(null, devices)

	.catch (error) ->
		return callback(error)

exports.remove = (id, callback) ->
	return canvas.delete
		resource: 'device'
		id: id
	.then ->
		return callback()
	.catch (error) ->
		return callback(error)

exports.identify = (uuid, callback) ->
	server.post(settings.get('urls.identify'), { uuid }, callback)
