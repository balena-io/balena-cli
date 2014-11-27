_ = require('lodash')
program = require('commander')
pluralize = require('pluralize')
indefiniteArticle = require('indefinite-article')
log = require('../log/log')

exports.getArgument = (name) ->
	return program[name]

exports.setVersion = (version) ->
	program.version(version)

	# Set version command automatically
	exports.addCommand 'version', 'show version', ->
		log.out(version)

exports.addCommand = (command, description, action) ->
	program
		.command(command)
		.description(description)
		.action(action)

	return program

exports.addOption = (option, description, coerceFunction) ->
	program.option(option, description, coerceFunction)

exports.addResource = (name, displayName, actions = {}) ->
	displayName ?= name
	nameArticle = indefiniteArticle(displayName)

	pluralizedName = pluralize(name)
	pluralizedDisplayName = pluralize(displayName)

	if _.isFunction(actions.create)
		exports.addCommand("#{name}:create <name>", "create #{nameArticle} #{displayName}", actions.create)

	if _.isFunction(actions.list)
		exports.addCommand("#{pluralizedName}", "list all #{pluralizedDisplayName}", actions.list)

	if _.isFunction(actions.info)
		exports.addCommand("#{name} <id>", "list a single #{displayName}", actions.info)

	if _.isFunction(actions.remove)
		exports.addCommand("#{name}:rm <id>", "remove #{nameArticle} #{displayName}", actions.remove)

exports.parse = (argv) ->
	program.parse(argv)
