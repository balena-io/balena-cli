_ = require('lodash')
PubNub = require('pubnub')
resin = require('../resin')

LOGS_HISTORY_COUNT = 200

exports.logs = (uuid) ->
	resin.models.device.getAll (error, devices) ->
		resin.errors.handle(error) if error?

		uuidExists = _.findWhere(devices, { uuid })?
		if not uuidExists
			return resin.errors.handle(new Error('Invalid UUID'))

		# PubNub needs to be initialised after logs
		# action was called, otherwise it prevents
		# all other actions from exiting on completion
		pubnub = PubNub.init(resin.config.pubnub)

		channel = "device-#{uuid}-logs"

		printLogs = (logs) ->
			logs = logs[0] if _.isArray(logs)
			resin.log.array(logs, resin.log.out)

		pubnub.history
			count: LOGS_HISTORY_COUNT
			channel: channel
			callback: printLogs

		pubnub.subscribe
			channel: channel
			callback: printLogs
