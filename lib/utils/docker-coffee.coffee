###*
# @license
# Copyright 2017-2019 Balena Ltd.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
###

# Functions to help actions which rely on using docker

Promise = require('bluebird')
_ = require('lodash')

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
			description: 'Path to a local docker socket (e.g. /var/run/docker.sock)'
			alias: 'P'
		},
		{
			signature: 'dockerHost'
			parameter: 'dockerHost'
			description: 'Docker daemon hostname or IP address (dev machine or balena device) '
			alias: 'h'
		},
		{
			signature: 'dockerPort'
			parameter: 'dockerPort'
			description: 'Docker daemon TCP port number (hint: 2375 for balena devices)'
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
		else
			# Use docker-modem defaults which take the DOCKER_HOST env var into account
			# https://github.com/apocas/docker-modem/blob/v2.0.2/lib/modem.js#L16-L65
			Modem = require('docker-modem')
			defaultOpts = new Modem()
			connectOpts[opt] = defaultOpts[opt] for opt in ['host', 'port', 'socketPath']

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
		# note: [^] matches any character, including line breaks
		pair = /^([^\s]+?)=([^]*)$/.exec(arg)
		if pair?
			buildArgs[pair[1]] = pair[2] ? ''
		else
			throw new Error("Could not parse build argument: '#{arg}'")
	return buildArgs

exports.generateBuildOpts = (options) ->
	opts = {}
	if options.tag?
		opts.t = options.tag
	if options.nocache?
		opts.nocache = true
	if options.squash?
		opts.squash = true
	if options.buildArg?
		opts.buildargs = parseBuildArgs(options.buildArg)
	if not _.isEmpty(options['registry-secrets'])
		opts.registryconfig = options['registry-secrets']
	return opts

exports.getDocker = (options) ->
	generateConnectOpts(options)
	.then(createClient)
	.tap(ensureDockerSeemsAccessible)

getDockerToolbelt = _.once ->
	Docker = require('docker-toolbelt')
	Promise.promisifyAll Docker.prototype, {
		filter: (name) -> name == 'run'
		multiArgs: true
	}
	Promise.promisifyAll(Docker.prototype)
	Promise.promisifyAll(new Docker({}).getImage().constructor.prototype)
	Promise.promisifyAll(new Docker({}).getContainer().constructor.prototype)
	return Docker

# docker-toolbelt v3 is not backwards compatible as it removes all *Async
# methods that are in wide use in the CLI. The workaround for now is to
# manually promisify the client and replace all `new Docker()` calls with
# this shared function that returns a promisified client.
#
# 	**New code must not use the *Async methods.**
#
exports.createClient = createClient = (opts) ->
	Docker = getDockerToolbelt()
	docker = new Docker(opts)
	modem = docker.modem
	# Workaround for a docker-modem 2.0.x bug where it sets a default
	# socketPath on Windows even if the input options specify a host/port.
	if modem.socketPath and modem.host
		if opts.socketPath
			modem.host = undefined
			modem.port = undefined
		else if opts.host
			modem.socketPath = undefined
	return docker

ensureDockerSeemsAccessible = (docker) ->
	{ exitWithExpectedError } = require('./patterns')
	docker.ping().catch ->
		exitWithExpectedError('Docker seems to be unavailable. Is it installed and running?')
