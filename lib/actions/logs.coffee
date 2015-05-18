_ = require('lodash')
resin = require('resin-sdk')

LOGS_HISTORY_COUNT = 200

module.exports =
	signature: 'logs <uuid>'
	description: 'show device logs'
	help: '''
		Use this command to show logs for a specific device.

		By default, the command prints all log messages and exit.

		To limit the output to the n last lines, use the `--num` option along with a number.
		This is similar to doing `resin logs <uuid> | tail -n X`.

		To continuously stream output, and see new logs in real time, use the `--tail` option.

		Note that for now you need to provide the whole UUID for this command to work correctly.

		This is due to some technical limitations that we plan to address soon.

		Examples:

			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --num 20
			$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail
	'''
	options: [
		{
			signature: 'num'
			parameter: 'num'
			description: 'number of lines to display'
			alias: 'n'
		}
		{
			signature: 'tail'
			description: 'continuously stream output'
			boolean: true
			alias: 't'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		resin.logs.subscribe params.uuid, {
			history: options.num or LOGS_HISTORY_COUNT
			tail: options.tail
		}, (error, message) ->
			return done(error) if error?
			if _.isArray(message)
				_.each message, (line) ->
					console.log(line.message)
			else
				console.log(message.message)
			return done()
