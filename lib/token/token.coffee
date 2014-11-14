# TODO: Persist token in a secure manner
data = require('../data/data')

TOKEN_KEY = 'token'

exports.saveToken = (newToken, callback) ->
	data.set(TOKEN_KEY, newToken, encoding: 'utf8', callback)

exports.hasToken = (callback) ->
	data.has(TOKEN_KEY, callback)

exports.getToken = (callback) ->
	data.get(TOKEN_KEY, encoding: 'utf8', callback)

exports.clearToken = (callback) ->
	data.has TOKEN_KEY, (hasToken) ->
		if hasToken
			return data.remove(TOKEN_KEY, callback)
		else
			return callback?()
