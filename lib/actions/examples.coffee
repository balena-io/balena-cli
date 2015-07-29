mkdirp = require('mkdirp')
async = require('async')
fs = require('fs')
path = require('path')
_ = require('lodash')
visuals = require('resin-cli-visuals')
vcs = require('resin-vcs')
examplesData = require('../data/examples.json')

exports.list =
	signature: 'examples'
	description: 'list all example applications'
	help: '''
		Use this command to list available example applications from resin.io

		Example:

			$ resin examples
	'''
	permission: 'user'
	action: ->
		examplesData = _.map examplesData, (example, index) ->
			example.id = index + 1
			return example

		examplesData = _.map examplesData, (example) ->
			example.author ?= 'Unknown'
			return example

		console.log visuals.table.horizontal examplesData, [
			'name'
			'display_name'
			'author'
		]

exports.info =
	signature: 'example <name>'
	description: 'list a single example application'
	help: '''
		Use this command to show information of a single example application

		Example:

			$ resin example cimon
	'''
	permission: 'user'
	action: (params, options, done) ->
		example = _.findWhere(examplesData, name: params.name)

		if not example?
			return done(new Error("Unknown example: #{params.name}"))

		example.author ?= 'Unknown'

		console.log visuals.table.vertical example, [
			"$#{example.display_name}$"
			'description'
			'author'
			'repository'
		]

		return done()

exports.clone =
	signature: 'example clone <name>'
	description: 'clone an example application'
	help: '''
		Use this command to clone an example application to the current directory

		This command outputs information about the cloning process.
		Use `--quiet` to remove that output.

		Example:

			$ resin example clone cimon
	'''
	permission: 'user'
	action: (params, options, done) ->
		example = _.findWhere(examplesData, name: params.name)

		if not example?
			return done(new Error("Unknown example: #{params.name}"))

		currentDirectory = process.cwd()
		destination = path.join(currentDirectory, example.name)

		mkdirp destination, (error) ->
			return done(error) if error?
			console.info("Cloning #{example.display_name} to #{destination}")
			vcs.clone(example.repository, destination).nodeify(done)
