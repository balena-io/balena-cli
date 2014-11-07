expect = require('chai').expect
_ = require('lodash')
mockFs = require('mock-fs')

fsUtils = require('./fs-utils')

PATHS =
	file:
		name: '/tmp/file1'
		contents: 'File1 contents'
	directory:
		name: '/tmp/dir'
		contents: mockFs.directory()

describe 'FsUtils', ->

	describe '#isValidPath()', ->

		it 'should return false for invalid paths', ->

			for invalidPath in [
				{ hello: 'world' }
				1234
				[ 1, 2, 3 ]
				undefined
				null
			]
				expect(fsUtils.isValidPath(invalidPath)).to.be.false

		it 'should return true for valid paths', ->

			for validPath in [
				'/Users/johndoe'
				'~/.resin'
				'../parent'
				'./file/../file2'
			]
				expect(fsUtils.isValidPath(validPath)).to.be.true

	describe '#isFile()', ->

		beforeEach ->
			mockFsOptions = {}
			for key, value of PATHS
				mockFsOptions[value.name] = value.contents
			mockFs(mockFsOptions)

		afterEach ->
			mockFs.restore()

		it 'should return true for files', (done) ->
			fsUtils.isFile PATHS.file.name, (error, isFile) ->
				expect(error).to.not.exist
				expect(isFile).to.be.true
				done()

		it 'should return false if file doesn\'t exists', (done) ->
			fsUtils.isFile '/nonexistentfile', (error, isFile) ->
				expect(error).to.exist
				expect(isFile).to.be.false
				done()

		it 'should return false if path is a directory', (done) ->
			fsUtils.isFile PATHS.directory.name, (error, isFile) ->
				expect(error).to.not.exist
				expect(isFile).to.be.false
				done()
