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

Promise = require('bluebird')
{ getBalenaSdk } = require('./lazy')

exports.QEMU_VERSION = QEMU_VERSION = 'v4.0.0-balena'
exports.QEMU_BIN_NAME = QEMU_BIN_NAME = 'qemu-execve'

exports.qemuPathInContext = (context) ->
	path = require('path')
	binDir = path.join(context, '.balena')
	binPath = path.join(binDir, QEMU_BIN_NAME)
	path.relative(context, binPath)

exports.copyQemu = (context, arch) ->
	path = require('path')
	fs = require('mz/fs')
	# Create a hidden directory in the build context, containing qemu
	binDir = path.join(context, '.balena')
	binPath = path.join(binDir, QEMU_BIN_NAME)

	Promise.resolve(fs.mkdir(binDir))
	.catch(code: 'EEXIST', ->)
	.then ->
		getQemuPath(arch)
	.then (qemu) ->
		new Promise (resolve, reject) ->
			read = fs.createReadStream(qemu)
			write = fs.createWriteStream(binPath)

			read
			.on('error', reject)
			.pipe(write)
			.on('error', reject)
			.on('finish', resolve)
	.then ->
		fs.chmod(binPath, '755')
	.then ->
		path.relative(context, binPath)

exports.getQemuPath = getQemuPath = (arch) ->
	balena = getBalenaSdk()
	path = require('path')
	fs = require('mz/fs')

	balena.settings.get('binDirectory')
	.then (binDir) ->
		Promise.resolve(fs.mkdir(binDir))
		.catch(code: 'EEXIST', ->)
		.then ->
			path.join(binDir, "#{QEMU_BIN_NAME}-#{arch}-#{QEMU_VERSION}")

exports.installQemu = (arch) ->
	request = require('request')
	fs = require('fs')
	zlib = require('zlib')
	tar = require('tar-stream')

	getQemuPath(arch)
	.then (qemuPath) ->
		new Promise (resolve, reject) ->
			installStream = fs.createWriteStream(qemuPath)

			qemuArch = balenaArchToQemuArch(arch)
			downloadArchiveName = "qemu-#{QEMU_VERSION.replace(/^v/, '')}-#{qemuArch}.tar.gz"
			qemuUrl = "https://github.com/balena-io/qemu/releases/download/#{QEMU_VERSION}/#{downloadArchiveName}"

			extract = tar.extract()
			extract.on 'entry', (header, stream, next) ->
				stream.on('end', next)
				if header.name.includes("qemu-#{qemuArch}-static")
					stream.pipe(installStream)
				else
					stream.resume()

			request(qemuUrl)
			.on('error', reject)
			.pipe(zlib.createGunzip())
			.on('error', reject)
			.pipe(extract)
			.on('error', reject)
			.on 'finish', ->
				fs.chmodSync(qemuPath, '755')
				resolve()

balenaArchToQemuArch = (arch) ->
	switch arch
		when 'armv7hf', 'rpi', 'armhf' then 'arm'
		when 'aarch64' then 'aarch64'
		else throw new Error("Cannot install emulator for architecture #{arch}")
