program = require('commander')
packageJSON = require('../../package.json')

auth = require('../auth/auth')
data = require('../data/data')
server = require('../server/server')
config = require('../config')

program.version(packageJSON.version)

program
	.command('login <username:password>')
	.description('Login with your resin.io account')
	.action (credentials) ->
		parsedCredentials = auth.parseCredentials(credentials)
		auth.login parsedCredentials, (error) ->
			throw error if error?

program
	.command('apps')
	.description('Show a list of your apps')
	.action ->

		# TODO: The details of requesting the API should be handled
		# by the models. Make use of them once they are implemented
		server.get '/ewa/application?$orderby=app_name%20asc&$expand=device', (error, response) ->
			for app in response.body.d
				console.log "#{app.id} - #{app.app_name}"

# TODO: Check if not running on UNIX environment
# and add a custom path accordingly
data.prefix.set config.dataPrefix, (error) ->
	throw error if error?
	program.parse(process.argv)
