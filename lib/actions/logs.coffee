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

{ normalizeUuidProp } = require('../utils/normalization')

module.exports =
	signature: 'logs <uuid>'
	description: 'show device logs'
	help: '''
		Use this command to show logs for a specific device.

		By default, the command prints all log messages and exit.

		To continuously stream output, and see new logs in real time, use the `--tail` option.

		Examples:

			$ resin logs 23c73a1
			$ resin logs 23c73a1
	'''
	options: [
		{
			signature: 'tail'
			description: 'continuously stream output'
			boolean: true
			alias: 't'
		}
	]
	permission: 'user'
	primary: true
	action: (params, options, done) ->
		normalizeUuidProp(params)
		resin = require('resin-sdk').fromSharedOptions()
		moment = require('moment')

		printLine = (line) ->
			timestamp = moment(line.timestamp).format('DD.MM.YY HH:mm:ss (ZZ)')
			console.log("#{timestamp} #{line.message}")

		promise = resin.logs.history(params.uuid).each(printLine)

		promise.then ->
			if options.tail
				resin.logs.subscribe(params.uuid).then (logs) ->
					logs.on('line', printLine)
					logs.on('error', done)
		.catch(done)
