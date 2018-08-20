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

allDeviceTypes = undefined

getDeviceTypes = ->
	Bluebird = require('bluebird')
	if allDeviceTypes != undefined
		return Bluebird.resolve(allDeviceTypes)
	resin = require('resin-sdk').fromSharedOptions()
	resin.models.config.getDeviceTypes()
	.tap (dt) ->
		allDeviceTypes = dt

getDeviceTypesWithSameArch = (deviceTypeSlug) ->
	_ = require('lodash')

	getDeviceTypes()
	.then (deviceTypes) ->
		deviceType = _.find(deviceTypes, slug: deviceTypeSlug)
		_(deviceTypes).filter(arch: deviceType.arch).map('slug').value()

getApplicationsWithSuccessfulBuilds = (deviceType) ->
	preload = require('resin-preload')
	resin = require('resin-sdk').fromSharedOptions()

	getDeviceTypesWithSameArch(deviceType)
	.then (deviceTypes) ->
		resin.pine.get
			resource: 'my_application'
			options:
				$filter:
					device_type:
						$in: deviceTypes
					owns__release:
						$any:
							$alias: 'r'
							$expr:
								r:
									status: 'success'
				$expand: preload.applicationExpandOptions
				$select: [ 'id', 'app_name', 'device_type', 'commit', 'should_track_latest_release' ]
				$orderby: 'app_name asc'

selectApplication = (deviceType) ->
	visuals = require('resin-cli-visuals')
	form = require('resin-cli-form')
	{ exitWithExpectedError } = require('../utils/patterns')

	applicationInfoSpinner = new visuals.Spinner('Downloading list of applications and releases.')
	applicationInfoSpinner.start()

	getApplicationsWithSuccessfulBuilds(deviceType)
	.then (applications) ->
		applicationInfoSpinner.stop()
		if applications.length == 0
			exitWithExpectedError("You have no apps with successful releases for a '#{deviceType}' device type.")
		form.ask
			message: 'Select an application'
			type: 'list'
			choices: applications.map (app) ->
				name: app.app_name
				value: app

selectApplicationCommit = (releases) ->
	form = require('resin-cli-form')
	{ exitWithExpectedError } = require('../utils/patterns')

	if releases.length == 0
		exitWithExpectedError('This application has no successful releases.')
	DEFAULT_CHOICE = { 'name': LATEST, 'value': LATEST }
	choices = [ DEFAULT_CHOICE ].concat releases.map (release) ->
		name: "#{release.end_timestamp} - #{release.commit}"
		value: release.commit
	return form.ask
		message: 'Select a release'
		type: 'list'
		default: LATEST
		choices: choices

offerToDisableAutomaticUpdates = (application, commit) ->
	Promise = require('bluebird')
	resin = require('resin-sdk').fromSharedOptions()
	form = require('resin-cli-form')

	if commit == LATEST or not application.should_track_latest_release
		return Promise.resolve()
	message = '''

		This application is set to automatically update all devices to the latest available version.
		This might be unexpected behaviour: with this enabled, the preloaded device will still
		download and install the latest release once it is online.

		Do you want to disable automatic updates for this application?

		Warning: To re-enable this requires direct api calls,
		see https://docs.resin.io/reference/api/resources/device/#set-device-to-release
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
	description: '(beta) preload an app on a disk image (or Edison zip archive)'
	help: '''
		Warning: "resin preload" requires Docker to be correctly installed in
		your shell environment. For more information (including Windows support)
		please check the README here: https://github.com/resin-io/resin-cli .

		Use this command to preload an application to a local disk image (or
		Edison zip archive) with a built release from Resin.io.

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
			description: '''
				the commit hash for a specific application release to preload, use "latest" to specify the latest release
				(ignored if no appId is given)
			'''
			alias: 'c'
		}
		{
			signature: 'splash-image'
			parameter: 'splashImage.png'
			description: 'path to a png image to replace the splash screen'
			alias: 's'
		}
		{
			signature: 'dont-check-arch'
			boolean: true
			description: 'Disables check for matching architecture in image and application'
		}
		{
			signature: 'pin-device-to-release'
			boolean: true
			description: 'Pin the preloaded device to the preloaded release on provision'
			alias: 'p'
		}
	]
	action: (params, options, done) ->
		_ = require('lodash')
		Promise = require('bluebird')
		resin = require('resin-sdk').fromSharedOptions()
		preload = require('resin-preload')
		visuals = require('resin-cli-visuals')
		nodeCleanup = require('node-cleanup')
		{ exitWithExpectedError } = require('../utils/patterns')

		progressBars = {}

		progressHandler = (event) ->
			progressBar = progressBars[event.name]
			if not progressBar
				progressBar = progressBars[event.name] = new visuals.Progress(event.name)
			progressBar.update(percentage: event.percentage)

		spinners = {}

		spinnerHandler = (event) ->
			spinner = spinners[event.name]
			if not spinner
				spinner = spinners[event.name] = new visuals.Spinner(event.name)
			if event.action == 'start'
				spinner.start()
			else
				console.log()
				spinner.stop()

		options.image = params.image
		options.appId = options.app
		delete options.app

		options.splashImage = options['splash-image']
		delete options['splash-image']

		options.dontCheckArch = options['dont-check-arch'] || false
		delete options['dont-check-arch']
		if options.dontCheckArch and not options.appId
			exitWithExpectedError('You need to specify an app id if you disable the architecture check.')

		options.pinDevice = options['pin-device-to-release'] || false
		delete options['pin-device-to-release']

		# Get a configured dockerode instance
		dockerUtils.getDocker(options)
		.then (docker) ->

			preloader = new preload.Preloader(
				resin
				docker
				options.appId
				options.commit
				options.image
				options.splashImage
				options.proxy
				options.dontCheckArch
				options.pinDevice
			)

			gotSignal = false

			nodeCleanup (exitCode, signal) ->
				if signal
					gotSignal = true
					nodeCleanup.uninstall()  # don't call cleanup handler again
					preloader.cleanup()
					.then ->
						# calling process.exit() won't inform parent process of signal
						process.kill(process.pid, signal)
					return false

			if process.env.DEBUG
				preloader.stderr.pipe(process.stderr)

			preloader.on('progress', progressHandler)
			preloader.on('spinner', spinnerHandler)

			return new Promise (resolve, reject) ->
				preloader.on('error', reject)

				preloader.prepare()
				.then ->
					# If no appId was provided, show a list of matching apps
					Promise.try ->
						if not preloader.appId
							selectApplication(preloader.config.deviceType)
							.then (application) ->
								preloader.setApplication(application)
				.then ->
					# Use the commit given as --commit or show an interactive commit selection menu
					Promise.try ->
						if options.commit
							if options.commit == LATEST and preloader.application.commit
								# handle `--commit latest`
								return LATEST
							release = _.find preloader.application.owns__release, (release) ->
								release.commit.startsWith(options.commit)
							if not release
								exitWithExpectedError('There is no release matching this commit')
							return release.commit
						selectApplicationCommit(preloader.application.owns__release)
					.then (commit) ->
						if commit == LATEST
							preloader.commit = preloader.application.commit
						else
							preloader.commit = commit

						# Propose to disable automatic app updates if the commit is not the latest
						offerToDisableAutomaticUpdates(preloader.application, commit)
				.then ->
					# All options are ready: preload the image.
					preloader.preload()
				.catch(resin.errors.ResinError, exitWithExpectedError)
				.then(resolve)
				.catch(reject)
			.then(done)
			.finally ->
				if not gotSignal
					preloader.cleanup()
