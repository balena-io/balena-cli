Promise = require('bluebird')
path = require('path')

exports.appendProjectOptions = appendProjectOptions = (opts) ->
	opts.concat [
		{
			signature: 'projectName'
			parameter: 'projectName'
			description: 'Specify an alternate project name; default is the directory name'
			alias: 'n'
		},
	]

exports.appendOptions = (opts) ->
	appendProjectOptions(opts).concat [
		{
			signature: 'emulated'
			description: 'Run an emulated build using Qemu'
			boolean: true
			alias: 'e'
		},
		{
			signature: 'logs'
			description: 'Display full log output'
			boolean: true
		},
	]

exports.generateOpts = (options) ->
	fs = require('mz/fs')
	fs.realpath(options.source || '.').then (projectPath) ->
		projectName: options.projectName
		projectPath: projectPath
		inlineLogs: !!options.logs

compositionFileNames = [
	'docker-compose.yml'
	'docker-compose.yaml'
]

# look into the given directory for valid compose files and return
# the contents of the first one found.
exports.resolveProject = resolveProject = (rootDir) ->
	fs = require('mz/fs')
	Promise.any compositionFileNames.map (filename) ->
		fs.readFile(path.join(rootDir, filename), 'utf-8')

# Parse the given composition and return a structure with info. Input is:
#  - composePath: the *absolute* path to the directory containing the compose file
#  - composeStr: the contents of the compose file, as a string
createProject = (composePath, composeStr, projectName = null) ->
	yml = require('js-yaml')
	compose = require('resin-compose-parse')

	# both methods below may throw.
	composition = yml.safeLoad(composeStr, schema: yml.FAILSAFE_SCHEMA)
	composition = compose.normalize(composition)

	projectName ?= path.basename(composePath)
	descriptors = compose.parse(composition).map (descr) ->
		# generate an image name based on the project and service names
		# if one is not given and the service requires a build
		if descr.image.context? and not descr.image.tag?
			descr.image.tag = [ projectName, descr.serviceName ].join('_').toLowerCase()
		return descr
	return {
		path: composePath,
		name: projectName,
		composition,
		descriptors
	}

# high-level function resolving a project and creating a composition out
# of it in one go. if image is given, it'll create a default project for
# that without looking for a project. falls back to creating a default
# project if none is found at the given projectPath.
exports.loadProject = (logger, projectPath, projectName, image) ->
	compose = require('resin-compose-parse')
	logger.logDebug('Loading project...')

	Promise.try ->
		if image?
			logger.logInfo("Creating default composition with image: #{image}")
			return compose.defaultComposition(image)

		logger.logDebug('Resolving project...')

		resolveProject(projectPath)
		.tap ->
			logger.logInfo('Compose file detected')
		.catch (e) ->
			logger.logDebug("Failed to resolve project: #{e}")
			logger.logInfo("Creating default composition with source: #{projectPath}")
			return compose.defaultComposition()
	.then (composeStr) ->
		logger.logDebug('Creating project...')
		createProject(projectPath, composeStr, projectName)

toPosixPath = (systemPath) ->
	path = require('path')
	systemPath.replace(new RegExp('\\' + path.sep, 'g'), '/')

exports.tarDirectory = tarDirectory = (dir) ->
	tar = require('tar-stream')
	klaw = require('klaw')
	path = require('path')
	fs = require('mz/fs')
	streamToPromise = require('stream-to-promise')
	{ FileIgnorer } = require('./ignore')

	getFiles = ->
		streamToPromise(klaw(dir))
		.filter((item) -> not item.stats.isDirectory())
		.map((item) -> item.path)

	ignore = new FileIgnorer(dir)
	pack = tar.pack()
	getFiles(dir)
	.each (file) ->
		type = ignore.getIgnoreFileType(path.relative(dir, file))
		if type?
			ignore.addIgnoreFile(file, type)
	.filter(ignore.filter)
	.map (file) ->
		relPath = path.relative(path.resolve(dir), file)
		Promise.join relPath, fs.stat(file), fs.readFile(file),
			(filename, stats, data) ->
				pack.entry({ name: toPosixPath(filename), size: stats.size, mode: stats.mode }, data)
	.then ->
		pack.finalize()
		return pack

truncateString = (str, len) ->
	return str if str.length < len
	str = str.slice(0, len)
	# return everything up to the last line. this is a cheeky way to avoid
	# having to deal with splitting the string midway through some special
	# character sequence.
	return str.slice(0, str.lastIndexOf('\n'))

LOG_LENGTH_MAX = 512 * 1024 # 512KB

exports.buildProject = (
	docker, logger,
	projectPath, projectName, composition,
	arch, deviceType,
	emulated, buildOpts,
	inlineLogs
) ->
	_ = require('lodash')
	humanize = require('humanize')
	compose = require('resin-compose-parse')
	builder = require('resin-multibuild')
	transpose = require('docker-qemu-transpose')
	qemu = require('./qemu')

	logger.logInfo("Building for #{arch}/#{deviceType}")

	imageDescriptors = compose.parse(composition)
	imageDescriptorsByServiceName = _.keyBy(imageDescriptors, 'serviceName')

	if inlineLogs
		renderer = new BuildProgressInline(logger.streams['build'], imageDescriptors)
	else
		tty = require('./tty')(process.stdout)
		renderer = new BuildProgressUI(tty, imageDescriptors)
	renderer.start()

	qemu.installQemuIfNeeded(emulated, logger)
	.tap (needsQemu) ->
		return if not needsQemu
		logger.logInfo('Emulation is enabled')
		# Copy qemu into all build contexts
		Promise.map imageDescriptors, (d) ->
			return if not d.image.context? # external image
			return qemu.copyQemu(path.join(projectPath, d.image.context))
	.then (needsQemu) ->
		# Tar up the directory, ready for the build stream
		tarDirectory(projectPath)
		.then (tarStream) ->
			builder.splitBuildStream(composition, tarStream)
		.tap (tasks) ->
			# Updates each task as a side-effect
			builder.performResolution(tasks, arch, deviceType)
			.map (task) ->
				if not task.external and not task.resolved
					throw new Error(
						"Project type for service '#{task.serviceName}' could not be determined. " +
						'Please add a Dockerfile'
					)
		.map (task) ->
			d = imageDescriptorsByServiceName[task.serviceName]

			# multibuild parses the composition internally so any tags we've
			# set before are lost; re-assign them here
			task.tag ?= [ projectName, task.serviceName ].join('_').toLowerCase()
			if d.image.context?
				d.image.tag = task.tag

			# configure build opts appropriately
			task.dockerOpts ?= {}
			_.merge(task.dockerOpts, buildOpts, { t: task.tag })
			if d.image.context?.args?
				task.dockerOpts.buildargs ?= {}
				_.merge(task.dockerOpts.buildargs, d.image.context.args)

			# Get the service-specific log stream
			# Caveat: `multibuild.BuildTask` defines no `logStream` property
			# but it's convenient to store it there; it's JS ultimately.
			task.logStream = renderer.streams[task.serviceName]
			task.logBuffer = []

			# Setup emulation if needed
			return [ task, null ] if task.external or not needsQemu
			binPath = qemu.qemuPathInContext(path.join(projectPath, task.context))
			transpose.transposeTarStream task.buildStream,
				hostQemuPath: toPosixPath(binPath)
				containerQemuPath: "/tmp/#{qemu.QEMU_BIN_NAME}"
			.then (stream) ->
				task.buildStream = stream
			.return([ task, binPath ])
	.map ([ task, qemuPath ]) ->
		Promise.resolve(task).tap (task) ->
			captureStream = buildLogCapture(task.external, task.logBuffer)

			if task.external
				# External image -- there's no build to be performed,
				# just follow pull progress.
				captureStream.pipe(task.logStream)
				task.progressHook = pullProgressAdapter(captureStream)
			else
				task.streamHook = (stream) ->
					stream = createLogStream(stream)
					if qemuPath?
						buildThroughStream = transpose.getBuildThroughStream
							hostQemuPath: toPosixPath(qemuPath)
							containerQemuPath: "/tmp/#{qemu.QEMU_BIN_NAME}"
						rawStream = stream.pipe(buildThroughStream)
					else
						rawStream = stream
					# `stream` sends out raw strings in contrast to `task.progressHook`
					# where we're given objects. capture these strings as they come
					# before we parse them.
					rawStream
					.pipe(dropEmptyLinesStream())
					.pipe(captureStream)
					.pipe(buildProgressAdapter(inlineLogs))
					.pipe(task.logStream)
	.then (tasks) ->
		logger.logDebug 'Prepared tasks; building...'
		builder.performBuilds(tasks, docker)
		.map (builtImage) ->
			if not builtImage.successful
				builtImage.error.serviceName = builtImage.serviceName
				throw builtImage.error

			d = imageDescriptorsByServiceName[builtImage.serviceName]
			task = _.find(tasks, serviceName: builtImage.serviceName)

			image =
				serviceName: d.serviceName
				name: d.image.tag ? d.image
				logs: truncateString(task.logBuffer.join('\n'), LOG_LENGTH_MAX)
				props:
					dockerfile: builtImage.dockerfile
					projectType: builtImage.projectType

			# Times here are timestamps, so test whether they're null
			# before creating a date out of them, as `new Date(null)`
			# creates a date representing UNIX time 0.
			if (startTime = builtImage.startTime)
				image.props.startTime = new Date(startTime)
			if (endTime = builtImage.endTime)
				image.props.endTime = new Date(endTime)
			docker.getImage(image.name).inspect().get('Size').then (size) ->
				image.props.size = size
			.return(image)
		.tap (images) ->
			summary = _(images).map ({ serviceName, props }) ->
				[ serviceName, "Image size: #{humanize.filesize(props.size)}" ]
			.fromPairs()
			.value()
			renderer.end(summary)
	.finally(renderer.end)

createRelease = (apiEndpoint, auth, userId, appId, composition) ->
	_ = require('lodash')
	crypto = require('crypto')
	releaseMod = require('resin-release')

	client = releaseMod.createClient({ apiEndpoint, auth })

	releaseMod.create
		client: client
		user: userId
		application: appId
		composition: composition
		source: 'local'
		commit: crypto.pseudoRandomBytes(16).toString('hex').toLowerCase()
	.then ({ release, serviceImages }) ->
		release = _.omit(release, [
			'created_at'
			'belongs_to__application'
			'is_created_by__user'
			'__metadata'
		])
		_.keys serviceImages, (serviceName) ->
			serviceImages[serviceName] = _.omit(serviceImages[serviceName], [
				'created_at'
				'is_a_build_of__service'
				'__metadata'
			])
		return { client, release, serviceImages }

tagServiceImages = (docker, images, serviceImages) ->
	Promise.map images, (d) ->
		serviceImage = serviceImages[d.serviceName]
		imageName = serviceImage.is_stored_at__image_location
		[ _match, registry, repo, tag = 'latest' ] = /(.*?)\/(.*?)(?::([^/]*))?$/.exec(imageName)
		name = "#{registry}/#{repo}"
		docker.getImage(d.name).tag({ repo: name, tag, force: true })
		.then ->
			docker.getImage("#{name}:#{tag}")
		.then (localImage) ->
			serviceName: d.serviceName
			serviceImage: serviceImage
			localImage: localImage
			registry: registry
			repo: repo
			logs: d.logs
			props: d.props

authorizePush = (tokenAuthEndpoint, registry, images) ->
	_ = require('lodash')
	sdk = require('resin-sdk').fromSharedOptions()

	if not _.isArray(images)
		images = [ images ]

	sdk.request.send
		baseUrl: tokenAuthEndpoint
		url: '/auth/v1/token'
		qs:
			service: registry
			scope: images.map (repo) ->
				"repository:#{repo}:pull,push"
	.get('body')
	.get('token')
	.catchReturn({})

pushAndUpdateServiceImages = (docker, token, images, afterEach) ->
	chalk = require('chalk')
	{ DockerProgress } = require('docker-progress')
	tty = require('./tty')(process.stdout)

	opts = { authconfig: registrytoken: token }

	progress = new DockerProgress(dockerToolbelt: docker)
	renderer = pushProgressRenderer(tty, chalk.blue('[Push]') + '    ')
	reporters = progress.aggregateProgress(images.length, renderer)

	Promise.using tty.cursorHidden(), ->
		Promise.map images, ({ serviceImage, localImage, props, logs }, index) ->
			Promise.join(
				localImage.inspect().get('Size')
				progress.push(localImage.name, reporters[index], opts).finally(renderer.end)
				(size, digest) ->
					serviceImage.image_size = size
					serviceImage.content_hash = digest
					serviceImage.build_log = logs
					serviceImage.dockerfile = props.dockerfile
					serviceImage.project_type = props.projectType
					serviceImage.start_timestamp = props.startTime if props.startTime
					serviceImage.end_timestamp = props.endTime if props.endTime
					serviceImage.push_timestamp = new Date()
					serviceImage.status = 'success'
			)
			.tapCatch (e) ->
				serviceImage.error_message = '' + e
				serviceImage.status = 'failed'
			.finally ->
				afterEach?(serviceImage, props)

exports.deployProject = (
	docker, logger,
	composition, images,
	appId, userId, auth,
	apiEndpoint,
	skipLogUpload
) ->
	_ = require('lodash')
	chalk = require('chalk')
	releaseMod = require('resin-release')
	tty = require('./tty')(process.stdout)

	prefix = chalk.cyan('[Info]') + '    '
	spinner = createSpinner()
	runloop = runSpinner(tty, spinner, "#{prefix}Creating release...")

	createRelease(apiEndpoint, auth, userId, appId, composition)
	.finally(runloop.end)
	.then ({ client, release, serviceImages }) ->
		logger.logDebug('Tagging images...')
		tagServiceImages(docker, images, serviceImages)
		.tap (images) ->
			logger.logDebug('Authorizing push...')
			authorizePush(apiEndpoint, images[0].registry, _.map(images, 'repo'))
			.then (token) ->
				logger.logInfo('Pushing images to registry...')
				pushAndUpdateServiceImages docker, token, images, (serviceImage) ->
					logger.logDebug("Saving image #{serviceImage.is_stored_at__image_location}")
					if skipLogUpload
						delete serviceImage.build_log
					releaseMod.updateImage(client, serviceImage.id, serviceImage)
			.finally ->
				logger.logDebug('Untagging images...')
				Promise.map images, ({ localImage }) ->
					localImage.remove()
		.then ->
			release.status = 'success'
		.tapCatch (e) ->
			release.status = 'failed'
		.finally ->
			runloop = runSpinner(tty, spinner, "#{prefix}Saving release...")
			release.end_timestamp = new Date()
			releaseMod.updateRelease(client, release.id, release)
			.finally(runloop.end)
		.return(release)

# utilities

renderProgressBar = (percentage, stepCount) ->
	_ = require('lodash')
	percentage = _.clamp(percentage, 0, 100)
	barCount = stepCount * percentage // 100
	spaceCount = stepCount - barCount
	bar = "[#{_.repeat('=', barCount)}>#{_.repeat(' ', spaceCount)}]"
	return "#{bar} #{_.padStart(percentage, 3)}%"

pushProgressRenderer = (tty, prefix) ->
	fn = (e) ->
		{ error, percentage } = e
		throw new Error(error) if error?
		bar = renderProgressBar(percentage, 40)
		tty.replaceLine("#{prefix}#{bar}\r")
	fn.end = ->
		tty.clearLine()
	return fn

createLogStream = (input) ->
	split = require('split')
	stripAnsi = require('strip-ansi-stream')
	return input.pipe(stripAnsi()).pipe(split())

dropEmptyLinesStream = ->
	through = require('through2')
	through (data, enc, cb) ->
		str = data.toString('utf-8')
		@push(str) if str.trim()
		cb()

buildLogCapture = (objectMode, buffer) ->
	through = require('through2')

	through { objectMode }, (data, enc, cb) ->
		# data from pull stream
		if data.error
			buffer.push("#{data.error}")
		else if data.progress and data.status
			buffer.push("#{data.progress}% #{data.status}")
		else if data.status
			buffer.push("#{data.status}")

		# data from build stream
		else
			buffer.push(data)

		cb(null, data)

buildProgressAdapter = (inline) ->
	through = require('through2')

	stepRegex = /^\s*Step\s+(\d+)\/(\d+)\s*: (.+)$/

	[ step, numSteps, progress ] = [ null, null, undefined ]

	through { objectMode: true }, (str, enc, cb) ->
		return cb(null, str) if not str?

		if inline
			return cb(null, { status: str })

		if /^Successfully tagged /.test(str)
			progress = undefined
		else
			if (match = stepRegex.exec(str))
				step = match[1]
				numSteps ?= match[2]
				str = match[3]
			if step?
				str = "Step #{step}/#{numSteps}: #{str}"
				progress = parseInt(step, 10) * 100 // parseInt(numSteps, 10)

		cb(null, { status: str, progress })

pullProgressAdapter = (outStream) ->
	return ({ status, id, percentage, error, errorDetail }) ->
		if status?
			status = status.replace(/^Status: /, '')
		if id?
			status = "#{id}: #{status}"
		if percentage is 100
			percentage = undefined
		outStream.write
			status: status
			progress: percentage
			error: errorDetail?.message ? error

createSpinner = ->
	chars = '|/-\\'
	index = 0
	-> chars[(index++) % chars.length]

runSpinner = (tty, spinner, msg) ->
	runloop = createRunLoop ->
		tty.clearLine()
		tty.writeLine("#{msg} #{spinner()}")
		tty.cursorUp()
	runloop.onEnd = ->
		tty.clearLine()
		tty.writeLine(msg)
	return runloop

createRunLoop = (tick) ->
	timerId = setInterval(tick, 1000 / 10)
	runloop = {
		onEnd: ->
		end: ->
			clearInterval(timerId)
			runloop.onEnd()
	}
	return runloop

class BuildProgressUI
	constructor: (tty, descriptors) ->
		_ = require('lodash')
		chalk = require('chalk')
		through = require('through2')

		eventHandler = @_handleEvent
		services = _.map(descriptors, 'serviceName')

		streams = _(services).map (service) ->
			stream = through.obj (event, _enc, cb) ->
				eventHandler(service, event)
				cb()
			stream.pipe(tty.stream)
			[ service, stream ]
		.fromPairs()
		.value()

		@_tty = tty
		@_serviceToDataMap = {}
		@_services = services

		# Logger magically prefixes the log line with [Build] etc., but it doesn't
		# work well with the spinner we're also showing. Manually build the prefix
		# here and bypass the logger.
		prefix = chalk.blue('[Build]') + '   '

		offset = 10 # account for escape sequences inserted for colouring
		@_prefixWidth = offset + prefix.length + _.max(_.map(services, 'length'))
		@_prefix = prefix

		# these are to handle window wrapping
		@_maxLineWidth = null
		@_lineWidths = []

		@_startTime = null
		@_ended = false
		@_cancelled = false
		@_spinner = createSpinner()

		@streams = streams

	_handleEvent: (service, event) =>
		@_serviceToDataMap[service] = event

	_handleInterrupt: =>
		@_cancelled = true
		@end()
		process.exit(130) # 128 + SIGINT

	start: =>
		process.on('SIGINT', @_handleInterrupt)
		@_tty.hideCursor()
		@_services.forEach (service) =>
			@streams[service].write({ status: 'Preparing...' })
		@_runloop = createRunLoop(@_display)
		@_startTime = Date.now()

	end: (summary = null) =>
		return if @_ended
		@_ended = true
		process.removeListener('SIGINT', @_handleInterrupt)
		@_runloop.end()
		@_runloop = null

		@_clear()
		@_renderStatus(true)
		@_renderSummary(summary ? @_getServiceSummary())
		@_tty.showCursor()

	_display: =>
		@_clear()
		@_renderStatus()
		@_renderSummary(@_getServiceSummary())
		@_tty.cursorUp(@_services.length + 1) # for status line

	_clear: ->
		@_tty.deleteToEnd()
		@_maxLineWidth = @_tty.currentWindowSize().width

	_getServiceSummary: ->
		_ = require('lodash')

		services = @_services
		serviceToDataMap = @_serviceToDataMap

		_(services).map (service) ->
			{ status, progress, error } = serviceToDataMap[service] ? {}
			if error
				return "#{error}"
			else if progress
				bar = renderProgressBar(progress, 20)
				return "#{bar} #{status}" if status
				return "#{bar}"
			else if status
				return "#{status}"
			else
				return 'Waiting...'
		.map (data, index) ->
			[ services[index], data ]
		.fromPairs()
		.value()

	_renderStatus: (end = false) ->
		moment = require('moment')
		require('moment-duration-format')(moment)

		@_tty.clearLine()
		@_tty.write(@_prefix)
		if end and @_cancelled
			@_tty.writeLine('Build cancelled')
		else if end
			serviceCount = @_services.length
			serviceStr = if serviceCount is 1 then '1 service' else "#{serviceCount} services"
			runTime = Date.now() - @_startTime
			durationStr = moment.duration(runTime // 1000, 'seconds').format()
			@_tty.writeLine("Built #{serviceStr} in #{durationStr}")
		else
			@_tty.writeLine("Building services... #{@_spinner()}")

	_renderSummary: (serviceToStrMap) ->
		_ = require('lodash')
		chalk = require('chalk')
		truncate = require('cli-truncate')
		strlen = require('string-width')

		@_services.forEach (service, index) =>
			str = _.padEnd(@_prefix + chalk.bold(service), @_prefixWidth)
			str += serviceToStrMap[service]
			if @_maxLineWidth?
				str = truncate(str, @_maxLineWidth)
			@_lineWidths[index] = strlen(str)

			@_tty.clearLine()
			@_tty.writeLine(str)

class BuildProgressInline
	constructor: (outStream, descriptors) ->
		_ = require('lodash')
		through = require('through2')

		services = _.map(descriptors, 'serviceName')
		eventHandler = @_renderEvent
		streams = _(services).map (service) ->
			stream = through.obj (event, _enc, cb) ->
				eventHandler(service, event)
				cb()
			stream.pipe(outStream)
			[ service, stream ]
		.fromPairs()
		.value()

		offset = 10 # account for escape sequences inserted for colouring
		@_prefixWidth = offset + _.max(_.map(services, 'length'))
		@_outStream = outStream
		@_services = services
		@_startTime = null
		@_ended = false

		@streams = streams

	start: =>
		@_outStream.write('Building services...\n')
		@_services.forEach (service) =>
			@streams[service].write({ status: 'Preparing...' })
		@_startTime = Date.now()

	end: (summary = null) =>
		moment = require('moment')
		require('moment-duration-format')(moment)

		return if @_ended
		@_ended = true

		if summary?
			@_services.forEach (service) =>
				@_renderEvent(service, summary[service])

		if @_cancelled
			@_outStream.write('Build cancelled\n')
		else
			serviceCount = @_services.length
			serviceStr = if serviceCount is 1 then '1 service' else "#{serviceCount} services"
			runTime = Date.now() - @_startTime
			durationStr = moment.duration(runTime // 1000, 'seconds').format()
			@_outStream.write("Built #{serviceStr} in #{durationStr}\n")

	_renderEvent: (service, event) =>
		_ = require('lodash')
		chalk = require('chalk')

		str = do ->
			{ status, error } = event
			if error
				return "#{error}"
			else if status
				return "#{status}"
			else
				return 'Waiting...'

		prefix = _.padEnd(chalk.bold(service), @_prefixWidth)
		@_outStream.write(prefix)
		@_outStream.write(str)
		@_outStream.write('\n')
