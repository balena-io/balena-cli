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

exports.add = permissions.user (params, options) ->
	if not options.application?
		resin.errors.handle(new Error('You have to specify an application'))

	if not params.value?
		params.value = process.env[params.key]

		if not params.value?
			resin.errors.handle(new Error("Environment value not found for key: #{params.key}"))
		else
			resin.log.info("Warning: using #{params.key}=#{params.value} from host environment")

	resin.models.environmentVariables.create options.application, params.key, params.value, (error) ->
		resin.errors.handle(error) if error?

exports.rename = permissions.user (params, options) ->
	resin.models.environmentVariables.update params.id, params.value, (error) ->
		resin.errors.handle(error) if error?
