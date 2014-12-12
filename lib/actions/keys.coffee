_ = require('lodash')
_.str = require('underscore.string')
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
