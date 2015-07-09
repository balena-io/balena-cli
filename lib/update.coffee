updateNotifier = require('update-notifier')
_ = require('lodash')
_.str = require('underscore.string')
packageJSON = require('../package.json')

exports.notify = (update) ->
	return if not process.stdout.isTTY

	console.log """
		> #{_.str.capitalize(update.type)} update available: #{update.current} -> #{update.latest}
		> Run:
		>		$ resin update
	"""

exports.check = (callback) ->
	notifier = updateNotifier(pkg: packageJSON)
	if notifier.update?
		exports.notify(notifier.update)
	return callback()
