_ = require('lodash')
resin = require('../resin')
ui = require('../ui')
permissions = require('../permissions/permissions')

SYSTEM_VAR_REGEX = /^RESIN_/

isSystemVariable = (environmentVariable) ->
	SYSTEM_VAR_REGEX.test(environmentVariable.name)

exports.list = permissions.user (params, options) ->
	if not options.application?
		resin.errors.handle(new Error('You have to specify an application'))

	resin.models.environmentVariables.getAllByApplication options.application, (error, environmentVariables) ->
		resin.errors.handle(error) if error?

		if not options.verbose
			environmentVariables = _.reject(environmentVariables, isSystemVariable)

		resin.log.out(ui.widgets.table.horizontal(environmentVariables))

exports.remove = permissions.user (params, options) ->
	ui.patterns.remove 'environment variable', options.yes, (callback) ->
		resin.models.environmentVariables.remove(params.id, callback)
	, resin.errors.handle
