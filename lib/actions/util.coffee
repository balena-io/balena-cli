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

_ = require('lodash')

exports.availableDrives =
	# TODO: dedupe with https://github.com/resin-io-modules/resin-cli-visuals/blob/master/lib/widgets/drive/index.coffee
	signature: 'util available-drives'
	description: 'list available drives'
	help: """
		Use this command to list your machine's drives usable for writing the OS image to.
		Skips the system drives.
	"""
	action: ->
		Promise = require('bluebird')
		drivelist = require('drivelist')
		driveListAsync = Promise.promisify(drivelist.list)
		chalk = require('chalk')
		visuals = require('resin-cli-visuals')

		formatDrive = (drive) ->
			size = drive.size / 1000000000
			return {
				device: drive.device
				size: "#{size.toFixed(1)} GB"
				description: drive.description
			}

		getDrives = ->
			driveListAsync().then (drives) ->
				return _.reject(drives, system: true)

		getDrives()
		.then (drives) ->
			if not drives.length
				console.error("#{chalk.red('x')} No available drives were detected, plug one in!")
				return

			console.log visuals.table.horizontal drives.map(formatDrive), [
				'device'
				'size'
				'description'
			]
