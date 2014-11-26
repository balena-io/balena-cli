_ = require('lodash')
Promise = require('bluebird')
canvas = require('./_canvas')
errors = require('../../errors/errors')

exports.getAll = ->
	return canvas.get
		resource: 'application'
		options:
			orderby: 'app_name asc'
			expand: 'device'
	.then (applications) ->
		if _.isEmpty(applications)
			return Promise.reject(new errors.NotAny('applications'))

		return applications

exports.get = (id) ->
	return canvas.get
		resource: 'application'
		id: id

	.then (application) ->
		if not application?
			return Promise.reject(new errors.NotFound("application #{id}"))

		return application

exports.create = (name, deviceType) ->
	return canvas.post
		resource: 'application'
		data:
			app_name: name
			device_type: deviceType

	.then (res) ->
		id = res?.id

		if not id?
			return Promise.reject(new errors.NotFound('created application id'))

		return id

exports.remove = (id) ->
	return canvas.delete
		resource: 'application'
		id: id
