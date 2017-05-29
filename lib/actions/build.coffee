# Imported here because it's needed for the setup
# of this action
Promise = require('bluebird')
dockerUtils = require('../utils/docker')

getBundleInfo = Promise.method (options) ->
	helpers = require('../utils/helpers')

	if options.application?
		# An application was provided
		return helpers.getAppInfo(options.application)
		.then (app) ->
			return [app.arch, app.device_type]
	else if options.arch? and options.deviceType?
		return [options.arch, options.deviceType]
	else
		# No information, cannot do resolution
		return undefined

module.exports =
	signature: 'build [source]'
	description: 'Build a container locally'
	permission: 'user'
	help: '''
		Use this command to build a container with a provided docker daemon.

		You must provide either an application or a device-type/architecture
		pair to use the resin Dockerfile pre-processor
		(e.g. Dockerfile.template -> Dockerfile).

		Examples:

			$ resin build
			$ resin build ./source/
			$ resin build --deviceType raspberrypi3 --arch armhf
			$ resin build --application MyApp ./source/
			$ resin build --docker '/var/run/docker.sock'
			$ resin build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem
	'''
	options: dockerUtils.appendOptions [
		{
			signature: 'arch'
			parameter: 'arch'
			description: 'The architecture to build for'
			alias: 'A'
		},
		{
			signature: 'deviceType'
			parameter: 'deviceType'
			description: 'The type of device this build is for'
			alias: 'd'
		},
		{
			signature: 'application'
			parameter: 'application'
			description: 'The target resin.io application this build is for'
			alias: 'a'
		},
	]
	action: (params, options, done) ->
		logging = require('../utils/logging')
		dockerUtils.runBuild(params, options, getBundleInfo, logging.getLogStreams())
		.asCallback(done)

