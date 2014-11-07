# TODO: Persist token in a secure manner
data = require('../data/data')

token = null

exports.saveToken = (newToken, callback) ->
	token = newToken
	return callback(null, token)

exports.hasToken = (callback) ->
	return callback(token?)

exports.getToken = (callback) ->
	return callback(null, token or undefined)

exports.clearToken = (callback) ->
	token = null
	return callback?(null)
