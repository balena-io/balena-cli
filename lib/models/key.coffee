canvas = require('./_canvas')

exports.getAll = ->
	return canvas.get
		resource: 'user__has__public_key'
