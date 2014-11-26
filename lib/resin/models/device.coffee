canvas = require('./_canvas')
_ = require('lodash')
Promise = require('bluebird')
errors = require('../errors/errors')

exports.getAll = (applicationId) ->
	return canvas.get
		resource: 'device'
		options:
			filter:
				application: applicationId
			expand: 'application'
			orderby: 'name asc'
	.then (devices) ->
		if _.isEmpty(devices)
			return Promise.reject(new errors.NotAny('devices'))

		return devices

exports.remove = (id) ->
	return canvas.delete
		resource: 'device'
		id: id
