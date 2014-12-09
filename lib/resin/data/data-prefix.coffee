_ = require('lodash')
mkdirp = require('mkdirp')
errors = require('../errors/errors')

# @nodoc
prefix = null

# Get current prefix
#
# @return {String} prefix
#
# @example Get prefix
#		prefix = resin.data.prefix.get()
#
exports.get = ->
	return prefix

# Set prefix
#
# @param {String} newPrefix new prefix
# @param {Function} callback callback (error)
#
# @throw {Error} Will throw if prefix is not a valid path
#
# @example Set prefix
#		resin.data.prefix.set '/opt/resin', (error) ->
#			throw error if error?
#
exports.set = (newPrefix, callback) ->
	if not _.isString(newPrefix)
		return callback?(new errors.InvalidPath(newPrefix))

	mkdirp newPrefix, (error) ->
		return callback?(error) if error?
		prefix = newPrefix
		return callback?()

# Clear prefix
#
# @example Clear prefix
#		resin.data.prefix.clear()
exports.clear = ->
	prefix = null
