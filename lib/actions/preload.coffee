###
Copyright 2016-2017 Balena

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

_ = require('lodash')
{ getBalenaSdk, getVisuals } = require('../utils/lazy')

dockerUtils = require('../utils/docker')

allDeviceTypes = undefined

isCurrent = (commit) ->
	return commit == 'latest' or commit == 'current'

getDeviceTypes = ->
	Bluebird = require('bluebird')
	_ = require('lodash')
	if allDeviceTypes != undefined
		return Bluebird.resolve(allDeviceTypes)
	balena = getBalenaSdk()
	balena.models.config.getDeviceTypes()
	.then (deviceTypes) ->
		_.sortBy(deviceTypes, 'name')
	.tap (dt) ->
		allDeviceTypes = dt

getDeviceTypesWithSameArch = (deviceTypeSlug) ->
	_ = require('lodash')

	getDeviceTypes()
	.then (deviceTypes) ->
		deviceType = _.find(deviceTypes, slug: deviceTypeSlug)
		_(deviceTypes).filter(arch: deviceType.arch).map('slug').value()

getApplicationsWithSuccessfulBuilds = (deviceType) ->
	preload = require('balena-preload')
	balena = getBalenaSdk()

	getDeviceTypesWithSameArch(deviceType)
	.then (deviceTypes) ->
		balena.pine.get
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
	visuals = getVisuals()
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
	DEFAULT_CHOICE = { 'name': 'current', 'value': 'current' }
	choices = [ DEFAULT_CHOICE ].concat releases.map (release) ->
		name: "#{release.end_timestamp} - #{release.commit}"
		value: release.commit
	return form.ask
		message: 'Select a release'
		type: 'list'
		default: 'current'
		choices: choices

offerToDisableAutomaticUpdates = (application, commit, pinDevice) ->
	Promise = require('bluebird')
	balena = getBalenaSdk()
	form = require('resin-cli-form')

	if isCurrent(commit) or not application.should_track_latest_release or pinDevice
		return Promise.resolve()
	message = '''

		This application is set to automatically update all devices to the current version.
		This might be unexpected behavior: with this enabled, the preloaded device will still
		download and install the current release once it is online.

		Do you want to disable automatic updates for this application?

		Warning: To re-enable this requires direct api calls,
		see https://balena.io/docs/reference/api/resources/device/#set-device-to-release

		Alternatively you can pass the --pin-device-to-release flag to pin only this device to the selected release.
	'''
	form.ask
		message: message,
		type: 'confirm'
	.then (update) ->
		if not update
			return
		balena.pine.patch
			resource: 'application'
			id: application.id
			body:
				should_track_latest_release: false

preloadOptions = dockerUtils.appendConnectionOptions [
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
			The commit hash for a specific application release to preload, use "current" to specify the current
			release (ignored if no appId is given). The current release is usually also the latest, but can be
			manually pinned using https://github.com/balena-io-projects/staged-releases .
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
	{
		signature: 'add-certificate'
		parameter: 'certificate.crt'
		description: '''
			Add the given certificate (in PEM format) to /etc/ssl/certs in the preloading container.
			The file name must end with '.crt' and must not be already contained in the preloader's
			/etc/ssl/certs folder.
			Can be repeated to add multiple certificates.
		'''
	}
]
# Remove dockerPort `-p` alias as it conflicts with pin-device-to-release
delete _.find(preloadOptions, signature: 'dockerPort').alias

module.exports =
	signature: 'preload <image>'
	description: 'preload an app on a disk image (or Edison zip archive)'
	help: '''
		Preload a balena application release (app images/containers), and optionally
		a balenaOS splash screen, in a previously downloaded balenaOS image file (or
		Edison zip archive) in the local disk. The balenaOS image file can then be
		flashed to a device's SD card.  When the device boots, it will not need to
		download the application, as it was preloaded.

		Warning: "balena preload" requires Docker to be correctly installed in
		your shell environment. For more information (including Windows support)
		check: https://github.com/balena-io/balena-cli/blob/master/INSTALL.md

		Examples:

			$ balena preload balena.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image image.png
			$ balena preload balena.img
	'''
	permission: 'user'
	primary: true
	options: preloadOptions
	action: (params, options, done) ->
		_ = require('lodash')
		Promise = require('bluebird')
		balena = getBalenaSdk()
		preload = require('balena-preload')
		visuals = getVisuals()
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

		options.commit = if isCurrent(options.commit) then 'latest' else options.commit
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

		if Array.isArray(options['add-certificate'])
			certificates = options['add-certificate']
		else if options['add-certificate'] == undefined
			certificates = []
		else
			certificates = [ options['add-certificate'] ]
		for certificate in certificates
			if not certificate.endsWith('.crt')
				exitWithExpectedError('Certificate file name must end with ".crt"')

		# Get a configured dockerode instance
		dockerUtils.getDocker(options)
		.then (docker) ->

			preloader = new preload.Preloader(
				balena
				docker
				options.appId
				options.commit
				options.image
				options.splashImage
				options.proxy
				options.dontCheckArch
				options.pinDevice
				certificates
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
							if isCurrent(options.commit) and preloader.application.commit
								# handle `--commit current` (and its `--commit latest` synonym)
								return 'latest'
							release = _.find preloader.application.owns__release, (release) ->
								release.commit.startsWith(options.commit)
							if not release
								exitWithExpectedError('There is no release matching this commit')
							return release.commit
						selectApplicationCommit(preloader.application.owns__release)
					.then (commit) ->
						if isCurrent(commit)
							preloader.commit = preloader.application.commit
						else
							preloader.commit = commit

						# Propose to disable automatic app updates if the commit is not the current release
						offerToDisableAutomaticUpdates(preloader.application, commit, options.pinDevice)
				.then ->
					# All options are ready: preload the image.
					preloader.preload()
				.catch(balena.errors.BalenaError, exitWithExpectedError)
				.then(resolve)
				.catch(reject)
			.then(done)
			.finally ->
				if not gotSignal
					preloader.cleanup()
