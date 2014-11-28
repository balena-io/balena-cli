_ = require('lodash')
PubNub = require('pubnub')
resin = require('../resin')
helpers = require('../helpers/helpers')

LOGS_HISTORY_COUNT = 200

exports.logs = (uuid) ->
	helpers.isDeviceUUIDValid uuid, (error, isValidUUID) ->
		resin.errors.handle(error) if error?

		if not isValidUUID
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
