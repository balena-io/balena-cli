Promise = require('bluebird')
_ = require('lodash')
_.str = require('underscore.string')
os = require('os')
chalk = require('chalk')

exports.getOperatingSystem = ->
	platform = os.platform()
	platform = 'osx' if platform is 'darwin'
	return platform

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

exports.waitStream = (stream) ->
	return new Promise (resolve, reject) ->
		stream.on('close', resolve)
		stream.on('end', resolve)
		stream.on('error', reject)
