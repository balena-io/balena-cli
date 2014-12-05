_ = require('lodash')
inquirer = require('inquirer')

exports.table = require('./table/table')

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

exports.select = (message, list, callback) ->
	inquirer.prompt [
		{
			type: 'list'
			name: 'option'
			message: message or 'Select an option'
			choices: list
		}
	], (response) ->
		return callback(null, response.option)

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
