_ = require('lodash-contrib')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')
log = require('../log/log')
errors = require('../errors/errors')

exports.list = permissions.user (params, options) ->
	resin.models.environmentVariables.getAllByApplication options.application, errors.handleCallback (environmentVariables) ->
		if not options.verbose
			environmentVariables = _.reject(environmentVariables, resin.models.environmentVariables.isSystemVariable)

		log.out(ui.widgets.table.horizontal(environmentVariables))

exports.remove = permissions.user (params, options) ->
	ui.patterns.remove 'environment variable', options.yes, (callback) ->
		resin.models.environmentVariables.remove(params.id, callback)
	, errors.handle

exports.add = permissions.user (params, options) ->
	if not params.value?
		params.value = process.env[params.key]

		if not params.value?
			errors.handle(new Error("Environment value not found for key: #{params.key}"))
		else
			log.info("Warning: using #{params.key}=#{params.value} from host environment")

	resin.models.environmentVariables.create(options.application, params.key, params.value, _.unary(errors.handle))

exports.rename = permissions.user (params, options) ->
	resin.models.environmentVariables.update(params.id, params.value, _.unary(errors.handle))
