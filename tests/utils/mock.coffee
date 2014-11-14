mockFs = require('mock-fs')
config = require('../../lib/config')

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
