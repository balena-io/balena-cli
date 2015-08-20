updateNotifier = require('update-notifier')
isRoot = require('is-root')
packageJSON = require('../../package.json')

# `update-notifier` creates files to make the next
# running time ask for updated, however this can lead
# to ugly EPERM issues if those files are created as root.
if not isRoot()
	notifier = updateNotifier(pkg: packageJSON)

exports.hasAvailableUpdate = ->
	return notifier?

exports.notify = ->
	return if not exports.hasAvailableUpdate()
	notifier.notify()
