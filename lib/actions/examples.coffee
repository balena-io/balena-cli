async = require('async')
fs = require('fs')
path = require('path')
_ = require('lodash')
gitCli = require('git-cli')
resin = require('resin-sdk')
permissions = require('../permissions/permissions')
ui = require('../ui')
examplesData = require('../data/examples.json')

exports.list = permissions.user ->

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

exports.info = permissions.user (params, options, done) ->
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

exports.clone = permissions.user (params, options, done) ->
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
