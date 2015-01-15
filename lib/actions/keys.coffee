_ = require('lodash')
_.str = require('underscore.string')
async = require('async')
fs = require('fs')
resin = require('resin-sdk')
helpers = require('../helpers/helpers')
ui = require('../ui')
log = require('../log/log')
permissions = require('../permissions/permissions')

exports.list = permissions.user (params, options, done) ->
	resin.models.key.getAll (error, keys) ->
		return done(error) if error?
		log.out ui.widgets.table.horizontal keys, [ 'ID', 'Title' ]
		return done()

exports.info = permissions.user (params, options, done) ->
	resin.models.key.get params.id, (error, key) ->
		return done(error) if error?
		key.public_key = '\n' + _.str.chop(key.public_key, resin.settings.get('sshKeyWidth')).join('\n')
		log.out(ui.widgets.table.vertical(key, [ 'ID', 'Title', 'Public Key' ]))
		return done()

exports.remove = permissions.user (params, options, done) ->
	ui.patterns.remove 'key', options.yes, (callback) ->
		resin.models.key.remove(params.id, callback)
	, done

exports.add = permissions.user (params, options, done) ->
	async.waterfall [

		(callback) ->
			if params.path?
				fs.readFile(params.path, encoding: 'utf8', callback)
			else
				helpers.readStdin(callback)

		(key, callback) ->
			resin.models.key.create(params.name, key, callback)

	], done
