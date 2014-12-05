_ = require('lodash')
resin = require('../resin')
helpers = require('../helpers/helpers')
cli = require('../cli/cli')
ui = require('../ui')

exports.list = ->
	resin.server.get resin.settings.get('urls.keys'), (error, response, keys) ->
		resin.errors.handle(error) if error?
		resin.log.out ui.widgets.table.horizontal keys, (key) ->
			delete key.public_key
			return key
		, [ 'ID', 'Title' ]

exports.info = (id) ->
	id = _.parseInt(id)

	# TODO: We don't have a way to query a single ssh key yet.
	# As a workaround, we request all of them, and filter
	# the one we need. Fix once we have a better way.
	resin.server.get resin.settings.get('urls.keys'), (error, response, keys) ->
		resin.errors.handle(error) if error?
		key = _.findWhere(keys, { id })
		if not key?
			resin.errors.handle(new resin.errors.NotFound("key #{id}"))

		key.public_key = '\n' + helpers.formatLongString(key.public_key, resin.settings.get('sshKeyWidth'))
		resin.log.out(ui.widgets.table.vertical(key, _.identity, [ 'ID', 'Title', 'Public Key' ]))

exports.remove = (id) ->
	confirmArgument = cli.getArgument('yes')
	ui.patterns.remove 'key', confirmArgument, (callback) ->
		url = _.template(resin.settings.get('urls.sshKey'), { id })
		resin.server.delete(url, callback)
	, resin.errors.handle
