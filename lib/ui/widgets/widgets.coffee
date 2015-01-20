_ = require('lodash')
inquirer = require('inquirer')
ProgressBar = require('progress')

exports.table = require('./table/table')

exports.register = (callback) ->
	inquirer.prompt([
		{
			type: 'input'
			name: 'email'
			message: 'Email'
		}
		{
			type: 'input'
			name: 'username'
			message: 'Username'
		}
		{
			type: 'password'
			name: 'password'
			message: 'Password'
			validate: (input) ->
				if input.length < 8
					return 'Password should be 8 characters long'

				return true
		}
	], _.partial(callback, null))

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

exports.confirm = (message, callback) ->
	inquirer.prompt [
		{
			type: 'confirm'
			name: 'confirmed'
			message: message
			default: false
		}
	], (response) ->
		return callback(null, response.confirmed)

exports.ask = (question, callback) ->
	inquirer.prompt [
		{
			type: 'input'
			name: 'answer'
			message: question
			validate: (input) ->
				return _.isString(input) and not _.isEmpty(input)
		}
	], (response) ->
		return callback(null, response.answer)

exports.Progress = class Progress extends ProgressBar
	constructor: (message, size) ->
		message = "#{message} [:bar] :percent :etas"
		options =
			complete: '='
			incomplete: ' '
			width: 40
			total: size

		super(message, options)
