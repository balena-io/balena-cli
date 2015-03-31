child_process = require('child_process')
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
		npm.isUpdated packageJSON.name, packageJSON.version, (error, isUpdated) ->
			return done(error) if error?

			if isUpdated
				return done(new Error('You\'re already running the latest version.'))

			# Attempting to self update using the NPM API was not considered safe.
			# A safer thing to do is to call npm as a child process
			# https://github.com/npm/npm/issues/7723
			child_process.exec "npm install -g #{packageJSON.name}", (error, stdout, stderr) ->
				return done(error) if error?
				return done(new Error(stderr)) if not _.isEmpty(stderr)

				console.info("Upgraded #{packageJSON.name}.")

				return done()
