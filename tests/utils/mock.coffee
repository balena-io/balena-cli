mockFs = require('mock-fs')
sinon = require('sinon')
config = require('../../lib/config')
connection = require('../../lib/connection/connection')

exports.fs =

	init: (filesystemConfig = {}) ->
		mockFsOptions = {}

		# Mock data prefix automatically to remove
		# duplication in most of the tests
		mockFsOptions[config.dataPrefix] = mockFs.directory()

		for key, value of filesystemConfig
			mockFsOptions[value.name] = value.contents
		mockFs(mockFsOptions)

	restore: ->
		mockFs.restore()

isOnlineStub = null

exports.connection =

	init: ->
		isOnlineStub = sinon.stub(connection, 'isOnline')
		isOnlineStub.yields(null, true)

	restore: ->
		isOnlineStub.restore()
