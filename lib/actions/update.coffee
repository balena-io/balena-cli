npm = require('../npm')
packageJSON = require('../../package.json')

exports.update =
	signature: 'update'
	description: 'update the resin cli'
	help: '''
		Use this command to update the Resin CLI

		This command outputs information about the update process.
		Use `--quiet` to remove that output.

		The Resin CLI checks for updates once per day.

		Major updates require a manual update with this update command,
		while minor updates are applied automatically.

		Examples:

			$ resin update
	'''
	action: (params, options, done) ->
		npm.update packageJSON.name, (error, version) ->
			return done(error) if error?
			console.info("Upgraded #{packageJSON.name} to v#{version}.")
			return done(null, version)
