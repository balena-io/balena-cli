_ = require('lodash')
table = require('../table/table')
patterns = require('../patterns/patterns')
resin = require('../resin')
authHooks = require('../hooks/auth')

SYSTEM_VAR_REGEX = /^RESIN_/

isSystemVariable = (environmentVariable) ->
	SYSTEM_VAR_REGEX.test(environmentVariable.name)

exports.list = authHooks.failIfNotLoggedIn (program) ->
	applicationId = program.parent?.application

	if not applicationId?
		resin.errors.handle(new Error('You have to specify an application'))

	resin.models.environmentVariables.getAll(applicationId).then (environmentVariables) ->

		if not program.parent.verbose?
			environmentVariables = _.reject(environmentVariables, isSystemVariable)

		resin.log.out(table.horizontal(environmentVariables))
	.catch(resin.errors.handle)

exports.remove = authHooks.failIfNotLoggedIn (id, program) ->
	patterns.remove 'environment variable', program.parent.yes, (callback) ->
		resin.models.environmentVariables.remove(id).then ->
			return callback()
		.catch(callback)
	, resin.errors.handle
