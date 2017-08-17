###
Copyright 2016-2017 Resin.io

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

dockerUtils = require('../utils/docker')

LATEST = 'latest'

getApplicationsWithSuccessfulBuilds = (resin, deviceType) ->
	resin.pine.get
		resource: 'my_application'
		options:
			filter:
				device_type: deviceType
				build:
					$any:
						$alias: 'b'
						$expr:
							b:
								status: 'success'
			expand:
				environment_variable:
					$select: ['name', 'value']
				build:
					$select: [ 'id', 'commit_hash', 'push_timestamp', 'status' ]
					$orderby: 'push_timestamp desc'
					# FIXME: The filter is commented because it causes an api error.
					# We manually filter out successful builds below.
					# We should move that here once this API error is resolved.
					#$filter:
					#	status: 'success'
			select: [ 'id', 'app_name', 'device_type', 'commit' ]
			orderby: 'app_name asc'
	# manual filtering
	.then (applications) ->
		applications.forEach (application) ->
			application.build = application.build.filter (build) ->
				build.status == 'success'
		applications

selectApplication = (expectedError, resin, form, deviceType) ->
	getApplicationsWithSuccessfulBuilds(resin, deviceType)
	.then (applications) ->
		if applications.length == 0
			expectedError("You have no apps with successful builds for a '#{deviceType}' device type.")
		form.ask
			message: 'Select an application'
			type: 'list'
			choices: applications.map (app) ->
				name: app.app_name
				value: app

selectApplicationCommit = (expectedError, resin, form, builds) ->
	if builds.length == 0
		expectedError('This application has no successful builds.')
	DEFAULT_CHOICE = {'name': LATEST, 'value': LATEST}
	choices = [ DEFAULT_CHOICE ].concat builds.map (build) ->
		name: "#{build.push_timestamp} - #{build.commit_hash}"
		value: build.commit_hash
	return form.ask
		message: 'Select a build'
		type: 'list'
		default: LATEST
		choices: choices

offerToDisableAutomaticUpdates = (Promise, form, resin, application, commit) ->
	if commit == LATEST or not application.should_track_latest_release
		return Promise.resolve()
	message = '''

		This application is set to automatically update all devices to the latest available version.
		This might be unexpected behaviour: with this enabled, the preloaded device will still
		download and install the latest build once it is online.

		Do you want to disable automatic updates for this application?
	'''
	form.ask
		message: message,
		type: 'confirm'
	.then (update) ->
		if not update
			return
		resin.pine.patch
			resource: 'application'
			id: application.id
			body:
				should_track_latest_release: false

module.exports =
	signature: 'preload <image>'
	description: '(beta) preload an app on a disk image'
	help: '''
		Warning: "resin preload" requires Docker to be correctly installed in
		your shell environment. For more information (including Windows support)
		please check the README here: https://github.com/resin-io/resin-cli .

		Use this command to preload an application to a local disk image with a
		built commit from Resin.io.
		This can be used with cloud builds, or images deployed with resin deploy.

		Examples:
		  $ resin preload resin.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image some-image.png
		  $ resin preload resin.img
	'''
	permission: 'user'
	primary: true
	options: dockerUtils.appendConnectionOptions [
		{
			signature: 'app'
			parameter: 'appId'
			description: 'id of the application to preload'
			alias: 'a'
		}
		{
			signature: 'commit'
			parameter: 'hash'
			description: 'a specific application commit to preload (ignored if no appId is given)'
			alias: 'c'
		}
		{
			signature: 'splash-image'
			parameter: 'splashImage.png'
			description: 'path to a png image to replace the splash screen'
			alias: 's'
		}
		{
			signature: 'dont-detect-flasher-type-images'
			boolean: true
			description: 'Disables the flasher type images detection: treats all images as non flasher types'
		}
	]
	action: (params, options, done) ->
		_ = require('lodash')
		Promise = require('bluebird')
		resin = require('resin-sdk-preconfigured')
		streamToPromise = require('stream-to-promise')
		form = require('resin-cli-form')
		preload = require('resin-preload')
		errors = require('resin-errors')
		{ expectedError } = require('../utils/patterns')

		options.image = params.image
		options.appId = options.app
		delete options.app

		options.dontDetectFlasherTypeImages = options['dont-detect-flasher-type-images']
		delete options['dont-detect-flasher-type-images']

		# Get a configured dockerode instance
		dockerUtils.getDocker(options)
		.then (docker) ->

			# Build the preloader image
			buildOutputStream = preload.build(docker)
			buildOutputStream.pipe(process.stdout)
			streamToPromise(buildOutputStream)

			# Get resin sdk settings so we can pass them to the preloader
			.then(resin.settings.getAll)
			.then (settings) ->
				options.proxy = settings.proxy
				options.apiHost = settings.apiUrl

				# Use the preloader docker image to extract the deviceType of the image
				preload.getDeviceTypeSlugAndPreloadedBuilds(docker, options)
				.catch(preload.errors.ResinError, expectedError)
			.then ({ slug, builds }) ->
				# Use the appId given as --app or show an interactive app selection menu
				Promise.try ->
					if options.appId
						return preload.getApplication(resin, options.appId)
						.catch(errors.ResinApplicationNotFound, expectedError)
					selectApplication(expectedError, resin, form, slug)
				.then (application) ->
					options.application = application

					# Check that the app device type and the image device type match
					if slug != application.device_type
						expectedError(
							"Image device type (#{application.device_type}) and application device type (#{slug}) do not match"
						)

					# Use the commit given as --commit or show an interactive commit selection menu
					Promise.try ->
						if options.commit
							if not _.find(application.build, commit_hash: options.commit)
								expectedError('There is no build matching this commit')
							return options.commit
						selectApplicationCommit(expectedError, resin, form, application.build)
					.then (commit) ->

						# No commit specified => use the latest commit
						if commit == LATEST
							options.commit = application.commit
						else
							options.commit = commit

						# Propose to disable automatic app updates if the commit is not the latest
						offerToDisableAutomaticUpdates(Promise, form, resin, application, commit)
				.then ->

					builds = builds.map (build) ->
						build.slice(-preload.BUILD_HASH_LENGTH)
					if options.commit in builds
						console.log('This build is already preloaded in this image.')
						process.exit(0)
					# All options are ready: preload the image.
					preload.run(resin, docker, options)
					.catch(preload.errors.ResinError, expectedError)
		.then (info) ->
			info.stdout.pipe(process.stdout)
			info.stderr.pipe(process.stderr)
			info.statusCodePromise
		.then (statusCode) ->
			if statusCode != 0
				process.exit(statusCode)
		.then(done)
