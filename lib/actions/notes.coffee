async = require('async')
permissions = require('../permissions/permissions')
helpers = require('../helpers/helpers')
resin = require('resin-sdk')

exports.set =
	signature: 'note [note]'
	description: 'set a device note'
	help: '''
		Use this command to set or update a device note.

		If note command isn't passed, the tool attempts to read from `stdin`.

		To view the notes, use $ resin device <id>.

		Examples:
			$ resin note "My useful note" --device 317
			$ cat note.txt | resin note --device 317
	'''
	options: [
		signature: 'device'
		parameter: 'device'
		description: 'device id'
		alias: [ 'd', 'dev' ]
		required: 'You have to specify a device'
	]
	action: permissions.user (params, options, done) ->
		async.waterfall([

			(callback) ->
				if not params.note?
					return helpers.readStdin(callback)
				return callback(null, params.note)

			(note, callback) ->
				resin.models.device.note(options.device, note, callback)

		], done)
