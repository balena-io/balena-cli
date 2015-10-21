validEmail = require('valid-email')

exports.validateEmail = (input) ->
	if not validEmail(input)
		return 'Email is not valid'

	return true

exports.validatePassword = (input) ->
	if input.length < 8
		return 'Password should be 8 characters long'

	return true

exports.validateApplicationName = (input) ->
	if input.length < 4
		return 'The application name should be at least 4 characters'

	return true
