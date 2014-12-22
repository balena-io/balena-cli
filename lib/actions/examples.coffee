_ = require('lodash')
resin = require('../resin')
permissions = require('../permissions/permissions')
ui = require('../ui')
examplesData = require('../data/examples.json')

exports.list = permissions.user ->

	examplesData = _.map examplesData, (example, index) ->
		example.id = index + 1
		return example

	resin.log.out ui.widgets.table.horizontal examplesData, (example) ->
		delete example.description
		example.author ?= 'Unknown'
		return example
	, [ 'ID', 'Name', 'Repository', 'Author' ]

exports.info = permissions.user (params) ->
	id = params.id - 1
	example = examplesData[id]

	if not example?
		error = new Error("Unknown example: #{id}")
		resin.errors.handle(error)

	resin.log.out ui.widgets.table.vertical example, (example) ->
		example.id = id
		example.author ?= 'Unknown'
		return example
	, [
		'ID'
		'Name'
		'Description'
		'Author'
		'Repository'
	]
