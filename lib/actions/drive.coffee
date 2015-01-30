visuals = require('resin-cli-visuals')
drive = require('../drive/drive')

exports.list =
	signature: 'drives'
	description: 'list available drives'
	help: '''
		Use this command to list all drives that are connected to your machine.

		Examples:
			$ resin drives
	'''
	permission: 'user'
	action: (params, options, done) ->
		drive.listDrives (error, drives) ->
			return done(error) if error?

			console.log visuals.widgets.table.horizontal drives, [
				'device'
				'description'
				'size'
			]

		return done()
