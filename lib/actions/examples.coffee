async = require('async')
fs = require('fs')
path = require('path')
_ = require('lodash')
gitCli = require('git-cli')
resin = require('resin-sdk')
ui = require('../ui')
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

		console.log ui.widgets.table.horizontal examplesData, [
			'ID'
			'Display Name'
			'Repository'
			'Author'
		]

exports.info =
	signature: 'example <id>'
	description: 'list a single example application'
	help: '''
		Use this command to show information of a single example application

		Example:
			$ resin example 3
	'''
	permission: 'user'
	action: (params, options, done) ->
		id = params.id - 1
		example = examplesData[id]

		if not example?
			return done(new Error("Unknown example: #{id}"))

		example.id = id
		example.author ?= 'Unknown'

		console.log ui.widgets.table.vertical example, [
			'ID'
			'Display Name'
			'Description'
			'Author'
			'Repository'
		]

		return done()

exports.clone =
	signature: 'example clone <id>'
	description: 'clone an example application'
	help: '''
		Use this command to clone an example application to the current directory

		This command outputs information about the cloning process.
		Use `--quiet` to remove that output.

		Example:
			$ resin example clone 3
	'''
	permission: 'user'
	action: (params, options, done) ->
		example = examplesData[params.id - 1]

		if not example?
			return done(new Error("Unknown example: #{id}"))

		async.waterfall [

			(callback) ->
				exampleAbsolutePath = path.join(process.cwd(), example.name)

				fs.exists exampleAbsolutePath, (exists) ->
					return callback() if not exists
					error = new Error("Directory exists: #{example.name}")
					return callback(error)

			(callback) ->
				console.info("Cloning #{example.display_name} to #{example.name}")
				gitCli.Repository.clone(example.repository, example.name, callback)

		], done
