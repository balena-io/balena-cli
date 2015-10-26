Promise = require('bluebird')
capitano = Promise.promisifyAll(require('capitano'))
_ = require('lodash')
_.str = require('underscore.string')
president = Promise.promisifyAll(require('president'))
os = require('os')
chalk = require('chalk')

exports.getGroupDefaults = (group) ->
	return _.chain(group)
		.get('options')
		.map (question) ->
			return [ question.name, question.default ]
		.object()
		.value()

exports.stateToString = (state) ->
	percentage = _.str.lpad(state.percentage, 3, '0') + '%'
	result = "#{chalk.blue(percentage)} #{chalk.cyan(state.operation.command)}"

	switch state.operation.command
		when 'copy'
			return "#{result} #{state.operation.from.path} -> #{state.operation.to.path}"
		when 'replace'
			return "#{result} #{state.operation.file.path}, #{state.operation.copy} -> #{state.operation.replace}"
		when 'run-script'
			return "#{result} #{state.operation.script}"
		else
			throw new Error("Unsupported operation: #{state.operation.type}")

exports.sudo = (command) ->

	# Bypass privilege elevation for Windows for now.
	# We should use `windosu` in this case.
	if os.platform() is 'win32'
		return capitano.runAsync(command.join(' '))

	command = _.union(_.take(process.argv, 2), command)

	console.log('Type your computer password to continue')
	return president.executeAsync(command)
