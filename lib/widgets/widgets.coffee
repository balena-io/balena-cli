_ = require('lodash')
inquirer = require('inquirer')

exports.login = (callback) ->
	inquirer.prompt([
		{
			type: 'input'
			name: 'username'
			message: 'Username'
		}
		{
			type: 'password'
			name: 'password'
			message: 'Password'
		}
	], _.partial(callback, null))

exports.confirmRemoval = (name, callback) ->
	inquirer.prompt [
		{
			type: 'confirm'
			name: 'confirmed'
			message: "Are you sure you want to delete the #{name}?"
			default: false
		}
	], (response) ->
		return callback(null, response.confirmed)
