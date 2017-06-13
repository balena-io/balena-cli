# Functions to help actions which rely on using docker

QEMU_VERSION = 'v2.5.50-resin-execve'
QEMU_BIN_NAME = 'qemu-execve'

# Use this function to seed an action's list of capitano options
# with the docker options. Using this interface means that
# all functions using docker will expose the same interface
#
# NOTE: Care MUST be taken when using the function, so as to
# not redefine/override options already provided.
exports.appendOptions = (opts) ->
	opts.concat [
		{
			signature: 'docker'
			parameter: 'docker'
			description: 'Path to a local docker socket'
			alias: 'P'
		},
		{
			signature: 'dockerHost'
			parameter: 'dockerHost'
			description: 'The address of the host containing the docker daemon'
			alias: 'h'
		},
		{
			signature: 'dockerPort'
			parameter: 'dockerPort'
			description: 'The port on which the host docker daemon is listening'
			alias: 'p'
		},
		{
			signature: 'ca'
			parameter: 'ca'
			description: 'Docker host TLS certificate authority file'
		},
		{
			signature: 'cert'
			parameter: 'cert'
			description: 'Docker host TLS certificate file'
		},
		{
			signature: 'key'
			parameter: 'key'
			description: 'Docker host TLS key file'
		},
		{
			signature: 'tag'
			parameter: 'tag'
			description: 'The alias to the generated image'
			alias: 't'
		},
		{
			signature: 'buildArg'
			parameter: 'arg'
			description: 'Set a build-time variable (eg. "-B \'ARG=value\'"). Can be specified multiple times.'
			alias: 'B'
		},
		{
			signature: 'nocache'
			description: "Don't use docker layer caching when building"
			boolean: true
		},
		{
			signature: 'emulated'
			description: 'Run an emulated build using Qemu'
			boolean: true
			alias: 'e'
		}
	]

exports.generateConnectOpts = generateConnectOpts = (opts) ->
	connectOpts = {}
	# Firsly need to decide between a local docker socket
	# and a host available over a host:port combo
	if opts.docker? and not opts.dockerHost?
		# good, local docker socket
		connectOpts.socketPath = opts.docker
	else if opts.dockerHost? and not opts.docker?
		# Good a host is provided, and local socket isn't
		connectOpts.host = opts.dockerHost
		connectOpts.port = opts.dockerPort || 2376
	else if opts.docker? and opts.dockerHost?
		# Both provided, no obvious way to continue
		throw new Error("Both a local docker socket and docker host have been provided. Don't know how to continue.")
	else
		# None provided, assume default docker local socket
		connectOpts.socketPath = '/var/run/docker.sock'

	# Now need to check if the user wants to connect over TLS
	# to the host

	# If any are set...
	if (opts.ca? or opts.cert? or opts.key?)
		# but not all
		if not (opts.ca? and opts.cert? and opts.key?)
			throw new Error('You must provide a CA, certificate and key in order to use TLS')
		connectOpts.ca = opts.ca
		connectOpts.cert = opts.cert
		connectOpts.key = opts.key

	return connectOpts

exports.tarDirectory = tarDirectory = (dir) ->
	Promise = require('bluebird')
	tar = require('tar-stream')
	klaw = require('klaw')
	path = require('path')
	fs = require('mz/fs')
	streamToPromise = require('stream-to-promise')

	getFiles = ->
		streamToPromise(klaw(dir))
		.filter((item) -> not item.stats.isDirectory())
		.map((item) -> item.path)

	pack = tar.pack()
	getFiles(dir)
	.map (file) ->
		relPath = path.relative(path.resolve(dir), file)
		Promise.join relPath, fs.stat(file), fs.readFile(file),
			(filename, stats, data) ->
				pack.entryAsync({ name: filename, size: stats.size, mode: stats.mode }, data)
	.then ->
		pack.finalize()
		return pack

cacheHighlightStream = ->
	colors = require('colors/safe')
	es = require('event-stream')
	{ EOL } = require('os')

	extractArrowMessage = (message) ->
		arrowTest = /^\s*-+>\s*(.+)/i
		if (match = arrowTest.exec(message))
			match[1]
		else
			undefined

	es.mapSync (data) ->
		msg = extractArrowMessage(data)
		if msg? and msg.toLowerCase() == 'using cache'
			data = colors.bgGreen.black(msg)
		return data + EOL

parseBuildArgs = (args, onError) ->
	_ = require('lodash')
	if not _.isArray(args)
		args = [ args ]
	buildArgs = {}
	args.forEach (str) ->
		pair = /^([^\s]+?)=(.*)$/.exec(str)
		if pair?
			buildArgs[pair[1]] = pair[2]
		else
			onError(str)
	return buildArgs

# Pass in the command line parameters and options and also
# a function which will return the information about the bundle
exports.runBuild = (params, options, getBundleInfo, logStreams) ->

	Promise = require('bluebird')
	dockerBuild = require('resin-docker-build')
	resolver = require('resin-bundle-resolve')
	es = require('event-stream')
	doodles = require('resin-doodles')
	transpose = require('docker-qemu-transpose')
	path = require('path')

	logging = require('../utils/logging')

	# The default build context is the current directory
	params.source ?= '.'
	logs = ''
	# Only used in emulated builds
	qemuPath = ''

	Promise.try ->
		return if not (options.emulated and platformNeedsQemu())

		hasQemu()
		.then (present) ->
			if !present
				logging.logInfo(logStreams, 'Installing qemu for ARM emulation...')
				installQemu()
		.then ->
			# Copy the qemu binary into the build context
			copyQemu(params.source)
		.then (binPath) ->
			qemuPath = path.relative(params.source, binPath)
	.then ->
		# Tar up the directory, ready for the build stream
		tarDirectory(params.source)
	.then (tarStream) ->
		new Promise (resolve, reject) ->
			hooks =
				buildSuccess: (image) ->
					if options.tag?
						console.log("Tagging image as #{options.tag}")
					# Show charlie. In the interest of cloud parity,
					# use console.log, not the standard logging streams
					doodle = doodles.getDoodle()
					console.log()
					console.log(doodle)
					console.log()

					resolve({ image, log: logs + '\n' + doodle + '\n' } )

				buildFailure: reject
				buildStream: (stream) ->
					if options.emulated
						logging.logInfo(logStreams, 'Running emulated build')

					getBundleInfo(options)
					.then (info) ->
						if !info?
							logging.logWarn logStreams, '''
								Warning: No architecture/device type or application information provided.
									Dockerfile/project pre-processing will not be performed.
							'''
							return tarStream
						else
							[arch, deviceType] = info
							# Perform type resolution on the project
							bundle = new resolver.Bundle(tarStream, deviceType, arch)
							resolver.resolveBundle(bundle, resolver.getDefaultResolvers())
							.then (resolved) ->
								logging.logInfo(logStreams, "Building #{resolved.projectType} project")

								return resolved.tarStream
					.then (buildStream) ->
						# if we need emulation
						if options.emulated and platformNeedsQemu()
							return transpose.transposeTarStream buildStream,
								hostQemuPath: qemuPath
								containerQemuPath: "./#{QEMU_BIN_NAME}"
						else
							return buildStream
					.then (buildStream) ->
						# Send the resolved tar stream to the docker daemon
						buildStream.pipe(stream)
					.catch(reject)

					# And print the output
					logThroughStream = es.through (data) ->
						logs += data.toString()
						this.emit('data', data)

					if options.emulated and platformNeedsQemu()
						buildThroughStream = transpose.getBuildThroughStream
							hostQemuPath: qemuPath
							containerQemuPath: "./#{QEMU_BIN_NAME}"

						newStream = stream.pipe(buildThroughStream)
					else
						newStream = stream

					newStream
					.pipe(logThroughStream)
					.pipe(cacheHighlightStream())
					.pipe(logStreams.build)

			# Create a builder
			connectOpts = generateConnectOpts(options)

			# Allow degugging output, hidden behind an env var
			logging.logDebug(logStreams, 'Connecting with the following options:')
			logging.logDebug(logStreams, JSON.stringify(connectOpts, null, '  '))

			builder = new dockerBuild.Builder(connectOpts)
			opts = {}

			if options.tag?
				opts['t'] = options.tag
			if options.nocache?
				opts['nocache'] = true
			if options.buildArg?
				opts['buildargs'] = parseBuildArgs options.buildArg, (arg) ->
					logging.logWarn(logStreams, "Could not parse variable: '#{arg}'")

			builder.createBuildStream(opts, hooks, reject)

# Given an image id or tag, export the image to a tar archive.
# Also needs the options generated by the appendOptions()
# function, and a tmpFile to buffer the data into.
exports.bufferImage = (docker, imageId, bufferFile) ->
	streamUtils = require('./streams')

	image = docker.getImage(imageId)
	image.get()
	.then (img) ->
		streamUtils.buffer(img, bufferFile)

exports.getDocker = (options) ->
	Docker = require('dockerode')
	Promise = require('bluebird')
	connectOpts = generateConnectOpts(options)
	# Use bluebird's promises
	connectOpts['Promise'] = Promise
	new Docker(connectOpts)

exports.getImageSize = (docker, image) ->
	docker.getImage(image).inspectAsync()
	.get('Size')

hasQemu = ->
	fs = require('mz/fs')

	getQemuPath()
	.then(fs.stat)
	.return(true)
	.catchReturn(false)

getQemuPath = ->
	resin = require('resin-sdk-preconfigured')
	path = require('path')
	fs = require('mz/fs')

	resin.settings.get('binDirectory')
	.then (binDir) ->
		# The directory might not be created already,
		# if not, create it
		fs.access(binDir)
		.catch code: 'ENOENT', ->
			fs.mkdir(binDir)
		.then ->
			path.join(binDir, QEMU_BIN_NAME)

platformNeedsQemu = ->
	os = require('os')
	os.platform() == 'linux'

installQemu = ->
	request = require('request')
	fs = require('fs')
	zlib = require('zlib')

	getQemuPath()
	.then (qemuPath) ->
		new Promise (resolve, reject) ->
			installStream = fs.createWriteStream(qemuPath)
			qemuUrl = "https://github.com/resin-io/qemu/releases/download/#{QEMU_VERSION}/#{QEMU_BIN_NAME}.gz"
			request(qemuUrl)
			.pipe(zlib.createGunzip())
			.pipe(installStream)
			.on('error', reject)
			.on('finish', resolve)

copyQemu = (context) ->
	path = require('path')
	fs = require('mz/fs')
	# Create a hidden directory in the build context, containing qemu
	binDir = path.join(context, '.resin')
	binPath = path.join(binDir, QEMU_BIN_NAME)

	fs.access(binDir)
	.catch code: 'ENOENT', ->
		fs.mkdir(binDir)
	.then ->
		getQemuPath()
	.then (qemu) ->
		new Promise (resolve, reject) ->
			read = fs.createReadStream(qemu)
			write = fs.createWriteStream(binPath)
			read
			.pipe(write)
			.on('error', reject)
			.on('finish', resolve)
	.then ->
		fs.chmod(binPath, '755')
	.return(binPath)

