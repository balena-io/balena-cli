_ = require('lodash')
Analytics = require('analytics.node').core
mixpanelIntegration = require('analytics.node').mixpanelIntegration
ravenIntegration = require('analytics.node').sentryIntegration
Promise = require('bluebird')
resin = require('resin-sdk-preconfigured')
packageJSON = require('../package.json')
Analytics.addIntegration(ravenIntegration)

exports.getLoggerInstance = _.memoize ->
	return resin.models.config.getMixpanelToken().then (token) ->
		Analytics.addIntegration(mixpanelIntegration)
		options = token: token
		Analytics.initialize 'Mixpanel': options

exports.trackCommand = (capitanoCommand) ->
	capitanoStateGetMatchCommandAsync = Promise.promisify(require('capitano').state.getMatchCommand)

	return Promise.props
		resinUrl: resin.settings.get('resinUrl')
		username: resin.auth.whoami().catchReturn(undefined)
		analytics: exports.getLoggerInstance()
	.then ({ username, resinUrl, analytics }) ->
		return capitanoStateGetMatchCommandAsync(capitanoCommand.command).then (command) ->
			Analytics.mergeContext(user: {
				id: username,
				username
			})
			analytics.track "[CLI] #{command.signature.toString()}",
				distinct_id: username
				argv: process.argv.join(' ')
				version: packageJSON.version
				node: process.version
				arch: process.arch
				resinUrl: resinUrl
				platform: process.platform
				command: capitanoCommand
	.timeout(100)
	.catchReturn()
