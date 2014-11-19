canvas = require('./_canvas')

exports.getAll = (applicationId) ->
	return canvas.get
		resource: 'device'
		options:
			filter:
				application: applicationId
			expand: 'application'
			orderby: 'name asc'
