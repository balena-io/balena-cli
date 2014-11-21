_ = require('lodash')
server = require('../server/server')
authHooks = require('../hooks/auth')
log = require('../log/log')
table = require('../table/table')
helpers = require('../helpers/helpers')
keyModel = require('../models/key')
config = require('../config')

exports.list = authHooks.failIfNotLoggedIn ->
	server.get config.urls.keys, (error, response, keys) ->
		throw error if error?
		log.out table.horizontal keys, (key) ->
			delete key.public_key
			return key
		, [ 'ID', 'Title' ]

exports.info = authHooks.failIfNotLoggedIn (id) ->
	id = _.parseInt(id)

	# TODO: We don't have a way to query a single ssh key yet.
	# As a workaround, we request all of them, and filter
	# the one we need. Fix once we have a better way.
	server.get config.urls.keys, (error, response, keys) ->
		throw error if error?
		key = _.findWhere(keys, { id })
		if not key?
			throw new Error("Key #{id} doesn't exists")

		key.public_key = '\n' + helpers.formatLongString(key.public_key, config.sshKeyWidth)
		log.out(table.vertical(key, _.identity, [ 'ID', 'Title', 'Public Key' ]))
