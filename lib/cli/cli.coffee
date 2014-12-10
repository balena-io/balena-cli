_ = require('lodash')
program = require('commander')
pluralize = require('pluralize')
indefiniteArticle = require('indefinite-article')
resin = require('../resin')
cliPermissions = require('./cli-permissions')

exports.getArgument = (name, coerceFunction) ->
	argument = program[name]
	return if not argument?

	if _.isFunction(coerceFunction)
		argument = coerceFunction(argument)

	return argument

exports.setVersion = (version) ->
	program.version(version)

	# Set version command automatically
	exports.addCommand
		command: 'version'
		description: 'show version'
		action: ->
			resin.log.out(version)

applyPermissions = (permission, action, onError) ->
	permissionFunction = cliPermissions[permission]
	if not _.isFunction(permissionFunction)
		throw new Error("Invalid permission #{permission}")
	return permissionFunction(action, onError)

exports.addCommand = (options = {}) ->

	_.defaults options,
		onError: resin.errors.handle

	if options.permission?
		action = applyPermissions(options.permission, options.action, options.onError)
	else
		action = options.action

	program
		.command(options.command)
		.description(options.description)
		.action(action)

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
			permission: options.permission

	if _.isFunction(options.actions.list)
		exports.addCommand
			command: "#{pluralizedName}"
			description: "list all #{pluralizedDisplayName}"
			action: options.actions.list
			permission: options.permission

	if _.isFunction(options.actions.info)
		exports.addCommand
			command: "#{options.name} <id>"
			description: "list a single #{options.displayName}"
			action: options.actions.info
			permission: options.permission

	if _.isFunction(options.actions.remove)
		exports.addCommand
			command: "#{options.name}:rm <id>"
			description: "remove #{nameArticle} #{options.displayName}"
			action: options.actions.remove
			permission: options.permission

exports.parse = (argv) ->

	exports.addCommand
		command: '*'
		action: ->
			program.outputHelp()

	program.parse(argv)
