_ = require('lodash')
async = require('async')
visuals = require('resin-cli-visuals')
drivelist = require('drivelist')

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
		drivelist.list (error, drives) ->
			return done(error) if error?

			async.reject drives, drivelist.isSystem, (removableDrives) ->

				if _.isEmpty(removableDrives)
					return done(new Error('No removable devices available'))

				console.log visuals.table.horizontal removableDrives, [
					'device'
					'description'
					'size'
				]

				return done()
