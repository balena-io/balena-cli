###
Copyright 2016 Resin.io

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

exports.list =
	signature: 'settings'
	description: 'print current settings'
	help: '''
		Use this command to display detected settings

		Examples:

			$ resin settings
	'''
	action: (params, options, done) ->
		resin = require('../resin-sdk')
		prettyjson = require('prettyjson')

		resin.settings.getAll()
			.then(prettyjson.render)
			.then(console.log)
			.nodeify(done)
