updateNotifier = require('update-notifier')
packageJSON = require('../package.json')
updateAction = require('./actions/update')

exports.perform = (callback) ->
	updateAction.update.action(null, null, callback)

exports.notify = (update) ->
	return if not process.stdout.isTTY

	console.log """
		> Major update available: #{update.current} -> #{update.latest}
		> Run resin update to update.
		> Beware that a major release might introduce breaking changes.\n
	"""

exports.check = (callback) ->
	notifier = updateNotifier(pkg: packageJSON)
	return callback() if not notifier.update?

	if notifier.update.type is 'major'
		exports.notify(notifier.update)
		return callback()

	console.log("Performing #{notifier.update.type} update, hold tight...")
	exports.perform(callback)
