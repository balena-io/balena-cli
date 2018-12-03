Promise = require('bluebird')

exports.QEMU_VERSION = QEMU_VERSION = 'v3.0.0+resin'
exports.QEMU_BIN_NAME = QEMU_BIN_NAME = 'qemu-execve'

exports.installQemuIfNeeded = Promise.method (emulated, logger, arch) ->
	return false if not (emulated and platformNeedsQemu())

	hasQemu(arch)
	.then (present) ->
		if !present
			logger.logInfo("Installing qemu for #{arch} emulation...")
			installQemu(arch)
	.return(true)

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

hasQemu = (arch) ->
	fs = require('mz/fs')

	getQemuPath(arch)
	.then(fs.stat)
	.return(true)
	.catchReturn(false)

getQemuPath = (arch) ->
	balena = require('balena-sdk').fromSharedOptions()
	path = require('path')
	fs = require('mz/fs')

	balena.settings.get('binDirectory')
	.then (binDir) ->
		Promise.resolve(fs.mkdir(binDir))
		.catch(code: 'EEXIST', ->)
		.then ->
			path.join(binDir, "#{QEMU_BIN_NAME}-#{arch}")

platformNeedsQemu = ->
	os = require('os')
	os.platform() == 'linux'

installQemu = (arch) ->
	request = require('request')
	fs = require('fs')
	zlib = require('zlib')
	tar = require('tar-stream')

	getQemuPath(arch)
	.then (qemuPath) ->
		new Promise (resolve, reject) ->
			installStream = fs.createWriteStream(qemuPath)

			qemuArch = balenaArchToQemuArch(arch)
			downloadArchiveName = "qemu-3.0.0+resin-#{qemuArch}.tar.gz"
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
