async = require('async')
fs = require('fs')
widgets = require('../widgets/widgets')
resin = require('../../resin')
ProgressBar = require('progress')

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
	received = 0

	resin.server.request
		method: 'GET'
		url: url
		pipe: fs.createWriteStream(dest)
	, (error) ->
		return callback(error)
	, (state) ->

		# TODO: Allow quieting this progress bar
		bar ?= new ProgressBar 'Downloading device OS [:bar] :percent :etas',
			complete: '='
			incomplete: ' '
			width: 40
			total: state.total

		return if bar.complete or not state?

		bar.tick(state.received - received)
		received = state.received
