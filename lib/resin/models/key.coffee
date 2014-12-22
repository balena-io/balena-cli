_ = require('lodash-contrib')
server = require('../server/server')
settings = require('../settings')
errors = require('../errors/errors')

# TODO: Do this with pinejs once it's exposed as an OData API

# Get all ssh keys
#
# @param {Function} callback callback(error, keys)
#
# @throw {NotAny} Will throw if no keys were found
#
# @example Get all keys
#		resin.models.key.getAll (error, keys) ->
#			throw error if error?
#			console.log(keys)
#
exports.getAll = (callback) ->
	url = settings.get('urls.keys')
	server.get url, (error, response, keys) ->
		return callback(error) if error?

		if _.isEmpty(keys)
			return callback(new errors.NotAny('keys'))

		return callback(null, keys)

# Get a single ssh key
#
# @param {String, Number} id key id
# @param {Function} callback callback(error, key)
#
# @throw {NotFound} Will throw if key was not found
#
# @example Find key
#		resin.models.key.get 51, (error, key) ->
#			throw error if error?
#			console.log(key)
#
exports.get = (id, callback) ->
	url = settings.get('urls.keys')
	server.get url, (error, response, keys) ->
		return callback(error) if error?

		key = _.findWhere(keys, { id })

		if not key?
			return callback(new errors.NotFound("key #{id}"))

		return callback(null, key)

# Remove ssh key
#
# @param {String, Number} id key id
# @param {Function} callback callback(error)
#
# @example Remove key
#		resin.models.key.remove 51, (error) ->
#			throw error if error?
#
exports.remove = (id, callback) ->
	url = settings.get('urls.sshKey')
	url = _.template(url, { id })
	server.delete(url, _.unary(callback))

# Create a ssh key
#
# @param {String} title key title
# @param {String} key the public ssh key
# @param {Function} callback callback(error)
#
# @todo We should return an id for consistency with the other models
#
# @example Create a key
#		resin.models.key.create 'Main', 'ssh-rsa AAAAB....', (error) ->
#			throw error if error?
#
exports.create = (title, key, callback) ->
	url = settings.get('urls.keys')
	data = { title, key }
	server.post(url, data, _.unary(callback))
