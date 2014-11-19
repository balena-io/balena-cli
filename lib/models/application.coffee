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
