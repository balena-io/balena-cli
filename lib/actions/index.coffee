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

{ normalizeCommands } = require('../utils/normalization')

module.exports =
	wizard: require('./wizard')
	app: require('./app')
	info: require('./info')
	auth: require('./auth')
	device: normalizeCommands(require('./device'))
	env: normalizeCommands(require('./environment-variables'))
	keys: require('./keys')
	logs: normalizeCommands(require('./logs'))
	local: require('./local')
	notes: normalizeCommands(require('./notes'))
	help: require('./help')
	os: normalizeCommands(require('./os'))
	settings: require('./settings')
	config: normalizeCommands(require('./config'))
	sync: require('./sync')
	ssh: normalizeCommands(require('./ssh'))
	internal: require('./internal')
	build: require('./build')
	deploy: require('./deploy')
	util: require('./util')
	preload: require('./preload')
