Promise = require('bluebird')
canvas = require('./_canvas')

exports.getAll = ->
	return canvas.get
		resource: 'application'
		options:
			orderby: 'app_name asc'
			expand: 'device'

exports.get = (id) ->
	return canvas.get
		resource: 'application'
		id: id

	.then (application) ->
		if not application?
			Promise.reject(new Error('Not found'))

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
			return Promise.reject(new Error('Could not find created application id.'))

		return id

exports.remove = (id) ->
	return canvas.delete
		resource: 'application'
		id: id
