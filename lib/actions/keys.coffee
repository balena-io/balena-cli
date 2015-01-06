_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
fs = require('fs')
resin = require('../resin')
helpers = require('../helpers/helpers')
ui = require('../ui')
log = require('../log/log')
permissions = require('../permissions/permissions')
errors = require('../errors/errors')

exports.list = permissions.user ->
	resin.models.key.getAll (error, keys) ->
		errors.handle(error) if error?

		log.out ui.widgets.table.horizontal keys, _.identity, [ 'ID', 'Title' ]

exports.info = permissions.user (params) ->
	resin.models.key.get params.id, (error, key) ->
		errors.handle(error) if error?

		key.public_key = '\n' + _.str.chop(key.public_key, resin.settings.get('sshKeyWidth')).join('\n')
		log.out(ui.widgets.table.vertical(key, _.identity, [ 'ID', 'Title', 'Public Key' ]))

exports.remove = permissions.user (params, options) ->
	ui.patterns.remove 'key', options.yes, (callback) ->
		resin.models.key.remove(params.id, callback)
	, errors.handle

exports.add = permissions.user (params) ->
	async.waterfall [

		(callback) ->
			if params.path?
				fs.readFile(params.path, encoding: 'utf8', callback)
			else
				helpers.readStdin(callback)

		(key, callback) ->
			key = key.trim()
			resin.models.key.create(params.name, key, callback)

	], errors.handle
