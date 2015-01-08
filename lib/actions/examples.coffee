async = require('async')
fs = require('fs')
path = require('path')
_ = require('lodash')
gitCli = require('git-cli')
resin = require('resin-sdk')
permissions = require('../permissions/permissions')
ui = require('../ui')
log = require('../log/log')
errors = require('../errors/errors')
examplesData = require('../data/examples.json')

exports.list = permissions.user ->

	examplesData = _.map examplesData, (example, index) ->
		example.id = index + 1
		return example

	examplesData = _.map examplesData, (example) ->
		example.author ?= 'Unknown'
		return example

	log.out ui.widgets.table.horizontal examplesData, [
		'ID'
		'Display Name'
		'Repository'
		'Author'
	]

exports.info = permissions.user (params) ->
	id = params.id - 1
	example = examplesData[id]

	if not example?
		error = new Error("Unknown example: #{id}")
		errors.handle(error)

	example.id = id
	example.author ?= 'Unknown'

	log.out ui.widgets.table.vertical example, [
		'ID'
		'Display Name'
		'Description'
		'Author'
		'Repository'
	]

exports.clone = permissions.user (params) ->
	example = examplesData[params.id - 1]

	if not example?
		error = new Error("Unknown example: #{id}")
		errors.handle(error)

	async.waterfall [

		(callback) ->
			exampleAbsolutePath = path.join(process.cwd(), example.name)

			fs.exists exampleAbsolutePath, (exists) ->
				return callback() if not exists
				error = new Error("Directory exists: #{example.name}")
				return callback(error)

		(callback) ->
			log.info("Cloning #{example.display_name} to #{example.name}")
			gitCli.Repository.clone(example.repository, example.name, callback)

	], (error) ->
		errors.handle(error) if error?
