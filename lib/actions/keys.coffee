_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
fs = require('fs')
resin = require('resin-sdk')
capitano = require('capitano')
visuals = require('resin-cli-visuals')
commandOptions = require('./command-options')

exports.list =
	signature: 'keys'
	description: 'list all ssh keys'
	help: '''
		Use this command to list all your SSH keys.

		Examples:

			$ resin keys
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.key.getAll (error, keys) ->
			return done(error) if error?
			console.log visuals.widgets.table.horizontal keys, [ 'id', 'title' ]
			return done()

SSH_KEY_WIDTH = 43

exports.info =
	signature: 'key <id>'
	description: 'list a single ssh key'
	help: '''
		Use this command to show information about a single SSH key.

		Examples:

			$ resin key 17
	'''
	permission: 'user'
	action: (params, options, done) ->
		resin.models.key.get params.id, (error, key) ->
			return done(error) if error?
			console.log(visuals.widgets.table.vertical(key, [ 'id', 'title', 'public_key' ]))
			return done()

exports.remove =
	signature: 'key rm <id>'
	description: 'remove a ssh key'
	help: '''
		Use this command to remove a SSH key from resin.io.

		Notice this command asks for confirmation interactively.
		You can avoid this by passing the `--yes` boolean option.

		Examples:

			$ resin key rm 17
			$ resin key rm 17 --yes
	'''
	options: [ commandOptions.yes ]
	permission: 'user'
	action: (params, options, done) ->
		visuals.patterns.remove 'key', options.yes, (callback) ->
			resin.models.key.remove(params.id, callback)
		, done

exports.add =
	signature: 'key add <name> [path]'
	description: 'add a SSH key to resin.io'
	help: '''
		Use this command to associate a new SSH key with your account.

		If `path` is omitted, the command will attempt
		to read the SSH key from stdin.

		Examples:

			$ resin key add Main ~/.ssh/id_rsa.pub
			$ cat ~/.ssh/id_rsa.pub | resin key add Main
	'''
	permission: 'user'
	action: (params, options, done) ->
		async.waterfall [

			(callback) ->
				if params.path?
					fs.readFile(params.path, encoding: 'utf8', callback)
				else
					capitano.utils.getStdin (data) ->
						return callback(null, data)

			(key, callback) ->
				resin.models.key.create(params.name, key, callback)

		], done
