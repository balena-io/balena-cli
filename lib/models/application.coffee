canvas = require('./_canvas')

exports.getAll = ->
	return canvas.get
		resource: 'application'
		options:
			orderby: 'app_name asc'
			expand: 'device'
