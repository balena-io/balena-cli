_ = require('lodash')
resin = require('../resin')
cli = require('../cli/cli')
ui = require('../ui')

SYSTEM_VAR_REGEX = /^RESIN_/

isSystemVariable = (environmentVariable) ->
	SYSTEM_VAR_REGEX.test(environmentVariable.name)

exports.list = ->
	applicationId = cli.getArgument('application')

	if not applicationId?
		resin.errors.handle(new Error('You have to specify an application'))

	resin.models.environmentVariables.getAllByApplication applicationId, (error, environmentVariables) ->
		resin.errors.handle(error) if error?

		if not cli.getArgument('verbose')?
			environmentVariables = _.reject(environmentVariables, isSystemVariable)

		resin.log.out(ui.widgets.table.horizontal(environmentVariables))

exports.remove = (id) ->
	confirmArgument = cli.getArgument('yes')
	ui.patterns.remove 'environment variable', confirmArgument, (callback) ->
		resin.models.environmentVariables.remove(id, callback)
	, resin.errors.handle
