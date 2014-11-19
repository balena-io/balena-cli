_ = require('lodash')
cliff = require('cliff')

KEY_DISPLAY_MAP =
	commit: 'Commit'
	app_name: 'Name'
	git_repository: 'Git Repository'
	device_type: 'Device Type'
	id: 'ID'

startsWithLetter = (string) ->
	firstLetter = _.first(string)
	return /[a-z|A-Z]/.test(firstLetter)

renameObjectKey = (object, key, newKey) ->
	object[newKey] = object[key]
	delete object[key]

exports.prepareObject = (object) ->
	object = _.omit object, (value, key) ->
		return not startsWithLetter(key)

	for key, value of object
		if _.isObject(value) and not _.isArray(value)
			object[key] = exports.prepareObject(value)

		displayKey = KEY_DISPLAY_MAP[key]
		if displayKey?
			renameObjectKey(object, key, displayKey)

	object = _.omit object, (value, key) ->

		# For some reason, _.isEmpty returns true for numbers
		return _.isEmpty(value) and not _.isNumber(value)

	return object

# TODO: Maybe there is a (sane) way to test this, given
# that the result is not automatically printed by cliff?
exports.horizontal = (contents, map, ordering, colours) ->
	contents = _.map(contents, map or _.noop)
	contents = _.map(contents, exports.prepareObject)
	ordering ?= _.keys(_.first(contents))
	return cliff.stringifyObjectRows(contents, ordering, colours)
