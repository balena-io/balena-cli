_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
fs = require('fs')
resin = require('../resin')
helpers = require('../helpers/helpers')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.list = permissions.user ->
	resin.server.get resin.settings.get('urls.keys'), (error, response, keys) ->
		resin.errors.handle(error) if error?
		resin.log.out ui.widgets.table.horizontal keys, (key) ->
			delete key.public_key
			return key
		, [ 'ID', 'Title' ]

exports.info = permissions.user (params) ->

	# TODO: We don't have a way to query a single ssh key yet.
	# As a workaround, we request all of them, and filter
	# the one we need. Fix once we have a better way.
	resin.server.get resin.settings.get('urls.keys'), (error, response, keys) ->
		resin.errors.handle(error) if error?
		key = _.findWhere(keys, id: params.id)
		if not key?
			resin.errors.handle(new resin.errors.NotFound("key #{params.id}"))

		key.public_key = '\n' + _.str.chop(key.public_key, resin.settings.get('sshKeyWidth')).join('\n')
		resin.log.out(ui.widgets.table.vertical(key, _.identity, [ 'ID', 'Title', 'Public Key' ]))

exports.remove = permissions.user (params, options) ->
	ui.patterns.remove 'key', options.yes, (callback) ->
		url = _.template(resin.settings.get('urls.sshKey'), id: params.id)
		resin.server.delete(url, callback)
	, resin.errors.handle

exports.add = permissions.user (params) ->
	async.waterfall [

		(callback) ->
			if params.path?
				fs.readFile(params.path, encoding: 'utf8', callback)
			else
				helpers.readStdin(callback)

		(key, callback) ->
			key = key.trim()

			url = resin.settings.get('urls.keys')
			data =
				title: params.name
				key: key
			resin.server.post(url, data, callback)

	], (error) ->
		return if not error?

		# TODO: Make handle() check the error type
		# and accomodate as most as possible to prevent
		# this types of checks in client code.
		if error.code is 'EISDIR'
			error.message = "File is a directory: #{params.path}"

		if error.code is 'ENOENT'
			error = new resin.errors.FileNotFound(params.path)

		resin.errors.handle(error)
