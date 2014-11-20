yargs = require('yargs')
_ = require('lodash')

commandIndexBySignature = (command) ->
	query = { signature: command.signature }
	return _.findIndex(@command._commands, query)

isArgVariable = (word) ->
	return /^(<.*>|\[.*\])$/.test(word)

splitSignature = (signature) ->
	return signature.split(' ')

commandApplies = (command, args) ->
	args._ ?= {}
	splittedCommandSignature = splitSignature(command.signature)
	if splittedCommandSignature.length isnt args._.length
		return false

	for word in splittedCommandSignature
		index = splittedCommandSignature.indexOf(word)

		if not isArgVariable(word) and word isnt args._[index]
			return false

	return true

run = ->
	if not @command._matchedCommand?
		return console.log(@help())
	signature = splitSignature(@command._matchedCommand.signature)
	parameters = _.difference(@argv._, signature)
	@command._matchedCommand.action.apply(this, parameters)

module.exports = (signature, action) ->
	command = { signature, action }

	@command._commands ?= []
	@command.run ?= _.bind(run, this)

	commandIndex = commandIndexBySignature.call(this, command)
	if commandIndex is -1
		@command._commands.push(command)
	else
		@command._commands.splice(commandIndex, 1, command)

	if commandApplies(command, @argv)
		@command._matchedCommand = command

	return this
