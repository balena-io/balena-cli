_ = require('lodash')
table = require('../table/table')
log = require('../log/log')
environemtVariablesModel = require('../models/environment-variables')
authHooks = require('../hooks/auth')

exports.list = authHooks.failIfNotLoggedIn (program) ->
	applicationId = program.parent.application

	if not applicationId?
		throw new Error('You have to specify an application')

	environemtVariablesModel.getAll(applicationId).then (environmentVariables) ->
		log.out(table.horizontal(environmentVariables))
	.catch (error) ->
		throw error
