_ = require('lodash')
_.str = require('underscore.string')

KEY_DISPLAY_MAP =
	app_name: 'Name'
	last_seen_time: 'Last Seen'
	ip_address: 'IP Address'
	id: 'ID'

startsWithLetter = (string) ->
	firstLetter = _.first(string)
	return /[a-z|A-Z]/.test(firstLetter)

renameObjectKey = (object, key, newKey) ->
	return if key is newKey
	object[newKey] = object[key]
	delete object[key]

exports.getKeyName = (key) ->
	nameFromMap = KEY_DISPLAY_MAP[key]
	return nameFromMap if nameFromMap?
	key = key.replace('_', ' ')
	return _.str.titleize(key)

exports.prepareObject = (object) ->
	object = _.omit object, (value, key) ->
		return not startsWithLetter(key)

	for key, value of object
		if _.isObject(value) and not _.isArray(value)
			object[key] = exports.prepareObject(value)

		newKeyName = exports.getKeyName(key)
		renameObjectKey(object, key, newKeyName)

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

exports.normaliseOrdering = (ordering, contents) ->
	if not _.isEmpty(ordering)
		return _.map(ordering, _.str.titleize)
	return exports.getDefaultContentsOrdering(contents)
