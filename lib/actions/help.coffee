_ = require('lodash')
_.str = require('underscore.string')
resin = require('resin-sdk')
capitano = require('capitano')

# TODO: Refactor this terrible mess

PADDING_INITIAL = '    '
PADDING_MIDDLE = '\t'

getFieldMaxLength = (array, field) ->
	return _.max _.map array, (item) ->
		return item[field].toString().length

buildHelpString = (firstColumn, secondColumn) ->
	result = "#{PADDING_INITIAL}#{firstColumn}"
	result += "#{PADDING_MIDDLE}#{secondColumn}"
	return result

addOptionPrefix = (option) ->
	return if option.length <= 0
	if option.length is 1
		return "-#{option}"
	else
		return "--#{option}"

addAlias = (alias) ->
	return ", #{addOptionPrefix(alias)}"

buildOptionSignatureHelp = (option) ->
	result = addOptionPrefix(option.signature.toString())

	if _.isString(option.alias)
		result += addAlias(option.alias)
	else if _.isArray(option.alias)
		for alias in option.alias
			result += addAlias(alias)

	if option.parameter?
		result += " <#{option.parameter}>"

	return result

getCommandHelp = (command) ->
	maxSignatureLength = getFieldMaxLength(capitano.state.commands, 'signature')
	commandSignature = _.str.rpad(command.signature.toString(), maxSignatureLength, ' ')
	return buildHelpString(commandSignature, command.description)

getOptionsParsedSignatures = (optionsHelp) ->
	maxLength = _.max _.map optionsHelp, (signature) ->
		return signature.length

	return _.map optionsHelp, (signature) ->
		return _.str.rpad(signature, maxLength, ' ')

getOptionHelp = (option, maxLength) ->
	result = PADDING_INITIAL
	result += _.str.rpad(option.signature, maxLength, ' ')
	result += PADDING_MIDDLE
	result += option.description
	return result

exports.general = ->
	console.log("Usage: #{process.argv[0]} [COMMAND] [OPTIONS]\n")
	console.log('Commands:\n')

	for command in capitano.state.commands
		continue if command.isWildcard()
		console.log(getCommandHelp(command))

	console.log('\nGlobal Options:\n')

	options = _.map capitano.state.globalOptions, (option) ->
		option.signature = buildOptionSignatureHelp(option)
		return option

	optionSignatureMaxLength = _.max _.map options, (option) ->
		return option.signature.length

	for option in options
		console.log(getOptionHelp(option, optionSignatureMaxLength))

	console.log()

exports.command = (params, options, done) ->
	capitano.state.getMatchCommand params.command, (error, command) ->
		return done(error) if error?

		if not command? or command.isWildcard()
			return capitano.defaults.actions.commandNotFound(params.command)

		console.log("Usage: #{command.signature}")

		if command.help?
			console.log("\n#{command.help}")
		else if command.description?
			console.log("\n#{_.str.humanize(command.description)}")

		if not _.isEmpty(command.options)
			console.log('\nOptions:\n')

			options = _.map command.options, (option) ->
				option.signature = buildOptionSignatureHelp(option)
				return option

			optionSignatureMaxLength = _.max _.map options, (option) ->
				return option.signature.toString().length

			for option in options
				console.log(getOptionHelp(option, optionSignatureMaxLength))

			console.log()

		return done()

exports.help =
	signature: 'help [command...]'
	description: 'show help'
	action: (params, options, done) ->
		if params.command?
			exports.command(params, options, done)
		else
			exports.general(params, options, done)
