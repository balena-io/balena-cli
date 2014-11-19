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

exports.processTableContents = (contents, map) ->

	# Allows us to simplify the algorithm by not
	# concerning about different input types
	if not _.isArray(contents)
		contents = [ contents ]

	contents = _.map(contents, map or _.identity)
	contents = _.map(contents, exports.prepareObject)
	return contents

isRealObject = (object) ->
	return false if _.isArray(object) or _.isFunction(object)
	return _.isObject(object)

exports.getDefaultContentsOrdering = (contents) ->
	return if _.isEmpty(contents)
	firstContentEntry = _.first(contents)
	return if not isRealObject(firstContentEntry)
	return _.keys(firstContentEntry)

# TODO: Maybe there is a (sane) way to test this, given
# that the result is not automatically printed by cliff?
exports.horizontal = (contents, map, ordering, colours) ->
	contents = exports.processTableContents(contents, map)
	ordering ?= exports.getDefaultContentsOrdering(contents)
	return cliff.stringifyObjectRows(contents, ordering, colours)

exports.vertical = (contents, map, ordering) ->
	contents = exports.processTableContents(contents, map)
	ordering ?= exports.getDefaultContentsOrdering(contents)

	result = []
	for item in contents
		for next in ordering
			result.push("#{next}: #{item[next]}")
	return result.join('\n')
