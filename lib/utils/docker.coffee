# Functions to help actions which rely on using docker

Promise = require('bluebird')

# Use this function to seed an action's list of capitano options
# with the docker options. Using this interface means that
# all functions using docker will expose the same interface
#
# NOTE: Care MUST be taken when using the function, so as to
# not redefine/override options already provided.
exports.appendConnectionOptions = appendConnectionOptions = (opts) ->
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
	]

# Use this function to seed an action's list of capitano options
# with the docker options. Using this interface means that
# all functions using docker will expose the same interface
#
# NOTE: Care MUST be taken when using the function, so as to
# not redefine/override options already provided.
exports.appendOptions = (opts) ->
	appendConnectionOptions(opts).concat [
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
			signature: 'squash'
			description: 'Squash newly built layers into a single new layer'
			boolean: true
		}
	]

generateConnectOpts = (opts) ->
	buildDockerodeOpts = require('dockerode-options')
	fs = require('mz/fs')
	_ = require('lodash')

	Promise.try ->
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
		else if process.env.DOCKER_HOST
			# If no explicit options are provided, use the env
			connectOpts = buildDockerodeOpts(process.env.DOCKER_HOST)
		else
			# No options anywhere, assume default docker local socket
			connectOpts.socketPath = '/var/run/docker.sock'

		# Now need to check if the user wants to connect over TLS
		# to the host

		# If any are set...
		if (opts.ca? or opts.cert? or opts.key?)
			# but not all
			if not (opts.ca? and opts.cert? and opts.key?)
				throw new Error('You must provide a CA, certificate and key in order to use TLS')

			certBodies = {
				ca: fs.readFile(opts.ca, 'utf-8')
				cert: fs.readFile(opts.cert, 'utf-8')
				key: fs.readFile(opts.key, 'utf-8')
			}
			return Promise.props(certBodies)
				.then (toMerge) ->
					_.merge(connectOpts, toMerge)

		return connectOpts

parseBuildArgs = (args) ->
	_ = require('lodash')
	if not _.isArray(args)
		args = [ args ]
	buildArgs = {}
	args.forEach (arg) ->
		pair = /^([^\s]+?)=(.*)$/.exec(arg)
		if pair?
			buildArgs[pair[1]] = pair[2] ? ''
		else
			throw new Error("Could not parse build argument: '#{arg}'")
	return buildArgs

exports.generateBuildOpts = (options) ->
	opts = {}
	if options.tag?
		opts['t'] = options.tag
	if options.nocache?
		opts['nocache'] = true
	if options.squash?
		opts['squash'] = true
	if options.buildArg?
		opts['buildargs'] = parseBuildArgs(options.buildArg)
	return opts

exports.getDocker = (options) ->
	generateConnectOpts(options)
	.tap (connectOpts) ->
		ensureDockerSeemsAccessible(connectOpts)
	.then(createClient)

exports.createClient = createClient = do ->
	# docker-toolbelt v3 is not backwards compatible as it removes all *Async
	# methods that are in wide use in the CLI. The workaround for now is to
	# manually promisify the client and replace all `new Docker()` calls with
	# this shared function that returns a promisified client.
	#
	# 	**New code must not use the *Async methods.**
	#
	Docker = require('docker-toolbelt')
	Promise.promisifyAll Docker.prototype, {
		filter: (name) -> name == 'run'
		multiArgs: true
	}
	Promise.promisifyAll(Docker.prototype)
	Promise.promisifyAll(new Docker({}).getImage().constructor.prototype)
	Promise.promisifyAll(new Docker({}).getContainer().constructor.prototype)

	return (opts) ->
		return new Docker(opts)

ensureDockerSeemsAccessible = (options) ->
	fs = require('mz/fs')

	if options.socketPath?
		# If we're trying to use a socket, check it exists and we have access to it
		fs.access(options.socketPath, (fs.constants || fs).R_OK | (fs.constants || fs).W_OK)
		.return(true)
		.catch (err) ->
			throw new Error(
				"Docker seems to be unavailable (using socket #{options.socketPath}). Is it
				installed, and do you have permission to talk to it?"
			)
	else
		# Otherwise, we think we're probably ok
		Promise.resolve(true)
