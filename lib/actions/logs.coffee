_ = require('lodash')
resin = require('resin-sdk')

module.exports =
	signature: 'logs <uuid>'
	description: 'show device logs'
	help: '''
	      	Use this command to show logs for a specific device.

	      	By default, the command prints all log messages and exit.

	      	To continuously stream output, and see new logs in real time, use the `--tail` option.

	      	Note that for now you need to provide the whole UUID for this command to work correctly.

	      	This is due to some technical limitations that we plan to address soon.

	      	Examples:

	      		$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
	      		$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail
	      '''
	options: [
		{
			signature: 'tail'
			description: 'continuously stream output'
			boolean: true
			alias: 't'
		}
	]
	permission: 'user'
	action: (params, options, done) ->
		promise = resin.logs.history(params.uuid).each (line) ->
			console.log(line.message)

		if not options.tail

			# PubNub keeps the process alive after a history query.
			# Until this is fixed, we force the process to exit.
			# This of course prevents this command to be used programatically
			return promise.catch(done).finally ->
				process.exit(0)

		promise.then ->
			resin.logs.subscribe(params.uuid).then (logs) ->
				logs.on 'line', (line) ->
					console.log(line.message)
				logs.on('error', done)
		.catch(done)
