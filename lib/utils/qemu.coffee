Promise = require('bluebird')

exports.QEMU_VERSION = QEMU_VERSION = 'v3.0.0+resin'
exports.QEMU_BIN_NAME = QEMU_BIN_NAME = 'qemu-execve'

exports.installQemuIfNeeded = Promise.method (emulated, logger, arch) ->
	return false if not (emulated and platformNeedsQemu())

	hasQemu()
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

exports.copyQemu = (context) ->
	path = require('path')
	fs = require('mz/fs')
	# Create a hidden directory in the build context, containing qemu
	binDir = path.join(context, '.balena')
	binPath = path.join(binDir, QEMU_BIN_NAME)

	Promise.resolve(fs.mkdir(binDir))
	.catch(code: 'EEXIST', ->)
	.then ->
		getQemuPath()
	.then (qemu) ->
		new Promise (resolve, reject) ->
			read = fs.createReadStream(qemu)
			write = fs.createWriteStream(binPath)
			read
			.pipe(write)
			.on('error', reject)
			.on('finish', resolve)
	.then ->
		fs.chmod(binPath, '755')
	.then ->
		path.relative(context, binPath)

hasQemu = ->
	fs = require('mz/fs')

	getQemuPath()
	.then(fs.stat)
	.return(true)
	.catchReturn(false)

getQemuPath = ->
	balena = require('balena-sdk').fromSharedOptions()
	path = require('path')
	fs = require('mz/fs')

	balena.settings.get('binDirectory')
	.then (binDir) ->
		Promise.resolve(fs.mkdir(binDir))
		.catch(code: 'EEXIST', ->)
		.then ->
			path.join(binDir, QEMU_BIN_NAME)

platformNeedsQemu = ->
	os = require('os')
	os.platform() == 'linux'

installQemu = (arch) ->
	request = require('request')
	fs = require('fs')
	zlib = require('zlib')
	tar = require('tar')
	os = require('os')
	path = require('path')
	rimraf = require('rimraf')

	getQemuPath()
	.then (qemuPath) ->
		new Promise (resolve, reject) ->
			downloadArchiveName = "qemu-3.0.0+resin-#{arch}.tar.gz"
			fs.mkdtemp(path.join(os.tmpdir(), 'balenaqemu-'), (err, folder) ->
				if err
					reject(err)
				qemuUrl = "https://github.com/balena-io/qemu/releases/download/#{QEMU_VERSION}/#{downloadArchiveName}"
				request(qemuUrl)
				.on('error', reject)
				.pipe(zlib.createGunzip())
				.on('error', reject)
				.pipe(tar.extract({
					C: folder,
					filter: (path, entry) -> return path.includes("qemu-#{arch}-static"),
					strip: 1
				})).on('finish', ->
					# copy qemu binary to intended location then clean up the temp directory
					tempFile = path.join(folder, "qemu-#{arch}-static")
					fs.copyFile(tempFile, qemuPath, (err) ->
						if err
							reject(err)
						# File moved successfully. Remove temp dir.
						rimraf(folder, (err) ->
							if err
								reject(err)
							resolve()
						)
					)
				)
			)
