_ = require('lodash')
_.str = require('underscore.string')

KEY_DISPLAY_MAP =
	app_name: 'Name'
	last_seen_time: 'Last Seen'
	ip_address: 'IP Address'
	id: 'ID'
	uuid: 'UUID'

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

	# Prevent modifying a value that is part of
	# the map values.
	# This is really an heuristic, as making sure
	# the client actually refers to that value means
	# converting the value to lowercase-underscore-cased
	# and do the check, but that seems overkill.
	if _.values(KEY_DISPLAY_MAP).indexOf(key) isnt -1
		return key

	key = _.str.humanize(key)
	return _.str.titleize(key)

isReallyEmpty = (value) ->

	# For some reason, _.isEmpty returns
	# true for numbers and booleans
	return false if _.isNumber(value) or _.isBoolean(value)

	return _.isEmpty(value)

exports.prepareObject = (object) ->
	object = _.omit object, (value, key) ->
		return not startsWithLetter(key)

	for key, value of object
		if _.isObject(value) and not _.isArray(value)
			object[key] = exports.prepareObject(value)

		newKeyName = exports.getKeyName(key)
		renameObjectKey(object, key, newKeyName)

	object = _.omit object, (value, key) ->
		return isReallyEmpty(value)

	return object

exports.processTableContents = (contents) ->
	return if not contents?

	# Allows us to simplify the algorithm by not
	# concerning about different input types
	if not _.isArray(contents)
		contents = [ contents ]

	return _.map(contents, exports.prepareObject)

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
		return _.map(ordering, exports.getKeyName)
	return exports.getDefaultContentsOrdering(contents)
