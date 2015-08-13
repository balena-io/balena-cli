_ = require('lodash')
resin = require('resin-sdk')

exports.set =
	signature: 'note <|note>'
	description: 'set a device note'
	help: '''
		Use this command to set or update a device note.

		If note command isn't passed, the tool attempts to read from `stdin`.

		To view the notes, use $ resin device <uuid>.

		Examples:

			$ resin note "My useful note" --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
			$ cat note.txt | resin note --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	'''
	options: [
		signature: 'device'
		parameter: 'device'
		description: 'device uuid'
		alias: [ 'd', 'dev' ]
		required: 'You have to specify a device'
	]
	permission: 'user'
	action: (params, options, done) ->

		if _.isEmpty(params.note)
			return done(new Error('Missing note content'))

		resin.models.device.note(options.device, params.note).nodeify(done)
