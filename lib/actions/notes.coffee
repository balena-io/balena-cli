async = require('async')
resin = require('resin-sdk')

exports.set =
	signature: 'note <|note>'
	description: 'set a device note'
	help: '''
		Use this command to set or update a device note.

		If note command isn't passed, the tool attempts to read from `stdin`.

		To view the notes, use $ resin device <name>.

		Examples:

			$ resin note "My useful note" --device MyDevice
			$ cat note.txt | resin note --device MyDevice
	'''
	options: [
		signature: 'device'
		parameter: 'device'
		description: 'device name'
		alias: [ 'd', 'dev' ]
		required: 'You have to specify a device'
	]
	permission: 'user'
	action: (params, options, done) ->
		resin.models.device.note(options.device, params.note, done)
