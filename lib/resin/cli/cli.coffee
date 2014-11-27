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
	exports.addCommand
		command: 'version'
		description: 'show version'
		action: ->
			log.out(version)

exports.addCommand = (options = {}) ->
	program
		.command(options.command)
		.description(options.description)
		.action(options.action)

	return program

exports.addOption = (options = {}) ->
	program.option(options.option, options.description, options.coerce)

exports.addResource = (options = {}) ->
	options.displayName ?= options.name
	nameArticle = indefiniteArticle(options.displayName)

	pluralizedName = pluralize(options.name)
	pluralizedDisplayName = pluralize(options.displayName)

	if _.isFunction(options.actions.create)
		exports.addCommand
			command: "#{options.name}:create <name>"
			description: "create #{nameArticle} #{options.displayName}"
			action: options.actions.create

	if _.isFunction(options.actions.list)
		exports.addCommand
			command: "#{pluralizedName}"
			description: "list all #{pluralizedDisplayName}"
			action: options.actions.list

	if _.isFunction(options.actions.info)
		exports.addCommand
			command: "#{options.name} <id>"
			description: "list a single #{options.displayName}"
			action: options.actions.info

	if _.isFunction(options.actions.remove)
		exports.addCommand
			command: "#{options.name}:rm <id>"
			description: "remove #{nameArticle} #{options.displayName}"
			action: options.actions.remove

exports.parse = (argv) ->
	program.parse(argv)
