async = require('async')
binary = require('node-binary')
fs = require('fs')
path = require('path')

DESTINATION = process.argv[2]

if not DESTINATION?
	console.error('Missing destination argument')
	process.exit(1)

NODE_VERSION = require('../package.json').bundled_engine
RESIN_BUNDLE = process.env.RESIN_BUNDLE

# This will install only the correct node version for the current system,
if not RESIN_BUNDLE? or RESIN_BUNDLE is 'current'

	bundles = [
		os: process.platform
		arch: process.arch
		version: NODE_VERSION
	]

else if RESIN_BUNDLE is 'darwin'

	bundles = [
		{ os: 'darwin', arch: 'x86', version: NODE_VERSION }
		{ os: 'darwin', arch: 'x64', version: NODE_VERSION }
	]

else if RESIN_BUNDLE is 'linux'

	bundles = [
		{ os: 'linux', arch: 'x86', version: NODE_VERSION }
		{ os: 'linux', arch: 'x64', version: NODE_VERSION }
	]

else if RESIN_BUNDLE is 'win32'

	bundles = [
		{ os: 'win32', arch: 'x86', version: NODE_VERSION }
		{ os: 'win32', arch: 'x64', version: NODE_VERSION }
	]

else
	console.error("Unknown RESIN_BUNDLE value: #{RESIN_BUNDLE}")
	process.exit(1)

getNodeName = (options) ->
	result = "node-#{options.os}-#{options.arch}"
	result += '.exe' if options.os is 'win32'
	return result

console.info 'Installing the following NodeJS bundles:'
for bundle in bundles
	console.info "- #{getNodeName(bundle)}"

nodeDownload = (destination, options, callback) ->
	try
		binary.download options, destination, (error, binaryPath) ->
			return callback(error) if error?
			output = path.join(destination, getNodeName(options))
			fs.rename binaryPath, output, (error) ->
				return callback(error) if error?
				return callback(null, output)
	catch error
		return callback(error)

async.eachLimit bundles, 2, (bundle, callback) ->
	console.info("Downloading: #{getNodeName(bundle)} to #{DESTINATION}")
	return nodeDownload DESTINATION, bundle, (error, output) ->
		return callback(error) if error?
		console.info("Downloaded: #{getNodeName(bundle)} to #{output}")
		return callback()
, (error) ->
	if error?
		console.error(error.message)
		console.error('Error: Couldn\'t get the required node bundle. Omitting.')
	else
		console.info('All NodeJS bundles downloaded')
