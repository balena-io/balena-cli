updateNotifier = require('update-notifier')
packageJSON = require('../../package.json')

notifier = updateNotifier(pkg: packageJSON)

exports.hasAvailableUpdate = ->
	return notifier?

exports.notify = ->
	return if not exports.hasAvailableUpdate()
	notifier.notify()
