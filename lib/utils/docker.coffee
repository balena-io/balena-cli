# Functions to help actions which rely on using docker

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
			signature: 'nocache'
			description: "Don't use docker layer caching when building"
			boolean: true
		},
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
				pack.entryAsync({ name: filename, size: stats.size }, data)
	.then ->
		pack.finalize()
		return pack

# Pass in the command line parameters and options and also
# a function which will return the information about the bundle
exports.runBuild = (params, options, getBundleInfo, logStreams) ->

	Promise = require('bluebird')
	dockerBuild = require('resin-docker-build')
	resolver = require('resin-bundle-resolve')
	es = require('event-stream')

	logging = require('../utils/logging')

	# The default build context is the current directory
	params.source ?= '.'
	logs = ''

	# Tar up the directory, ready for the build stream
	tarDirectory(params.source)
	.then (tarStream) ->
		new Promise (resolve, reject) ->
			hooks =
				buildSuccess: (image) ->
					if options.tag?
						console.log("Tagging image as #{options.tag}")
					resolve({ image, log: logs } )
				buildFailure: reject
				buildStream: (stream) ->
					getBundleInfo(options)
					.then (info) ->
						if !info?
							logging.logWarn logStreams, '''
								Warning: No architecture/device type or application information provided.
									Dockerfile/project pre-processing will not be performed.
							'''
							tarStream.pipe(stream)
						else
							[arch, deviceType] = info
							# Perform type resolution on the project
							bundle = new resolver.Bundle(tarStream, deviceType, arch)
							resolver.resolveBundle(bundle, resolver.getDefaultResolvers())
							.then (resolved) ->
								logging.logInfo(logStreams, "Building #{resolved.projectType} project")
								# Send the resolved tar stream to the docker daemon
								resolved.tarStream.pipe(stream)
					.catch(reject)

					# And print the output
					throughStream = es.through (data) ->
						logs += data.toString()
						this.emit('data', data)

					stream.pipe(es.pipe(throughStream, logStreams.build))

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

			builder.createBuildStream(opts, hooks, reject)

# Given an image id or tag, export the image to a tar archive.
# Also needs the options generated by the appendOptions()
# function, and a tmpFile to buffer the data into.
exports.bufferImage = (docker, imageId, tmpFile) ->
	Promise = require('bluebird')
	fs = require('fs')

	stream = fs.createWriteStream(tmpFile)

	image = docker.getImage(imageId)
	image.get()
	.then (img) ->
		new Promise (resolve, reject) ->
			img
			.on('error', reject)
			.on('end', resolve)
			.pipe(stream)
	.then ->
		new Promise (resolve, reject) ->
			fs.createReadStream(tmpFile)
			.on 'open', ->
				resolve(this)
			.on('error', reject)

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
