async = require('async')
pace = require('pace')
fs = require('fs')
widgets = require('../widgets/widgets')
server = require('../../server/server')

exports.remove = (name, confirmAttribute, deleteFunction, outerCallback) ->
	async.waterfall([

		(callback) ->
			if confirmAttribute
				return callback(null, true)

			widgets.confirmRemoval(name, callback)

		(confirmed, callback) ->
			return callback() if not confirmed
			deleteFunction(callback)

	], outerCallback)

exports.downloadFile = (url, dest, callback) ->
	bar = null
	server.request
		method: 'GET'
		url: url
		pipe: fs.createWriteStream(dest)
	, (error) ->
		return callback(error)
	, (state) ->
		return if not state?
		bar ?= pace(state.total)
		bar.op(state.received)
