_ = require('lodash-contrib')
resin = require('resin-sdk')
ui = require('../ui')
permissions = require('../permissions/permissions')

exports.list = permissions.user (params, options, done) ->
	resin.models.environmentVariables.getAllByApplication options.application, (error, environmentVariables) ->
		return done(error) if error?

		if not options.verbose
			environmentVariables = _.reject(environmentVariables, resin.models.environmentVariables.isSystemVariable)

		console.log(ui.widgets.table.horizontal(environmentVariables))
		return done()

exports.remove = permissions.user (params, options, done) ->
	ui.patterns.remove 'environment variable', options.yes, (callback) ->
		resin.models.environmentVariables.remove(params.id, callback)
	, done

exports.add = permissions.user (params, options, done) ->
	if not params.value?
		params.value = process.env[params.key]

		if not params.value?
			return done(new Error("Environment value not found for key: #{params.key}"))
		else
			console.info("Warning: using #{params.key}=#{params.value} from host environment")

	resin.models.environmentVariables.create(options.application, params.key, params.value, done)

exports.rename = permissions.user (params, options, done) ->
	resin.models.environmentVariables.update(params.id, params.value, done)
