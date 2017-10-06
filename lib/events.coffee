_ = require('lodash')
Mixpanel = require('mixpanel')
Raven = require('raven')
Promise = require('bluebird')
resin = require('resin-sdk-preconfigured')
packageJSON = require('../package.json')

exports.getLoggerInstance = _.memoize ->
	return resin.models.config.getMixpanelToken().then(Mixpanel.init)

exports.trackCommand = (capitanoCommand) ->
	capitanoStateGetMatchCommandAsync = Promise.promisify(require('capitano').state.getMatchCommand)

	return Promise.props
		resinUrl: resin.settings.get('resinUrl')
		username: resin.auth.whoami().catchReturn(undefined)
		mixpanel: exports.getLoggerInstance()
	.then ({ username, resinUrl, mixpanel }) ->
		return capitanoStateGetMatchCommandAsync(capitanoCommand.command).then (command) ->
			Raven.mergeContext(user: {
				id: username,
				username
			})
			mixpanel.track "[CLI] #{command.signature.toString()}",
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
