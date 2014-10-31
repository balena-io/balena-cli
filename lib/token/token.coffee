# TODO: Persist token in a secure manner

token = null

exports.saveToken = (newToken) ->
	token = newToken

exports.hasToken = ->
	return token?

exports.getToken = ->
	return token or undefined

exports.clearToken = ->
	token = null
