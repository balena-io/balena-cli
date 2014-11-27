_ = require('lodash')
resin = require('../resin')

SYSTEM_VAR_REGEX = /^RESIN_/

isSystemVariable = (environmentVariable) ->
	SYSTEM_VAR_REGEX.test(environmentVariable.name)

exports.list = ->
	applicationId = resin.cli.getArgument('application')

	if not applicationId?
		resin.errors.handle(new Error('You have to specify an application'))

	resin.models.environmentVariables.getAll applicationId, (error, environmentVariables) ->
		resin.errors.handle(error) if error?

		if not resin.cli.getArgument('verbose')?
			environmentVariables = _.reject(environmentVariables, isSystemVariable)

		resin.log.out(resin.ui.widgets.table.horizontal(environmentVariables))

exports.remove = (id) ->
	confirmArgument = resin.cli.getArgument('yes')
	resin.ui.patterns.remove 'environment variable', confirmArgument, (callback) ->
		resin.models.environmentVariables.remove(id, callback)
	, resin.errors.handle
