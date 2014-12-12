_ = require('lodash')
PubNub = require('pubnub')
resin = require('../resin')
helpers = require('../helpers/helpers')
permissions = require('../permissions/permissions')

LOGS_HISTORY_COUNT = 200

getLogData = (logs) ->
	return logs[0] if _.isArray(logs)
	return logs

printLogs = (logs, number) ->
	logs = getLogData(logs)
	logs = _.last(logs, number) if _.isNumber(number)
	resin.log.array(logs, resin.log.out)

exports.logs = permissions.user (params, options) ->

	numberOfLines = options.num
	tailOutput = options.tail or false

	if numberOfLines? and not _.isNumber(numberOfLines)
		resin.errors.handle(new Error('n/num should be a number'))

	helpers.isDeviceUUIDValid params.uuid, (error, isValidUUID) ->
		resin.errors.handle(error) if error?

		if not isValidUUID
			return resin.errors.handle(new Error('Invalid UUID'))

		# PubNub needs to be initialised after logs
		# action was called, otherwise it prevents
		# all other actions from exiting on completion
		pubnub = PubNub.init(resin.settings.get('pubnub'))

		channel = _.template(resin.settings.get('events.deviceLogs'), uuid: params.uuid)

		pubnub.history
			count: LOGS_HISTORY_COUNT
			channel: channel
			callback: (logs) ->
				printLogs(logs, numberOfLines)
				if not tailOutput or numberOfLines?
					process.exit(0)

		if tailOutput
			pubnub.subscribe
				channel: channel
				callback: printLogs
