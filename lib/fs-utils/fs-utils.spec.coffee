expect = require('chai').expect
mockFs = require('mock-fs')
fsUtils = require('./fs-utils')

FILESYSTEM =
	text:
		name: '/tmp/text'
		contents: 'Hello World'
	directory:
		name: '/tmp/directory'
		contents: mockFs.directory()

describe 'FsUtils:', ->

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

	describe '#isDirectory()', ->

		beforeEach ->
			mockFsOptions = {}
			for key, value of FILESYSTEM
				mockFsOptions[value.name] = value.contents
			mockFs(mockFsOptions)

		afterEach ->
			mockFs.restore()

		it 'should return true if directory', (done) ->
			fsUtils.isDirectory FILESYSTEM.directory.name, (error, isDirectory) ->
				expect(error).to.not.exist
				expect(isDirectory).to.be.true
				done()

		it 'should return false if not a directory', (done) ->
			fsUtils.isDirectory FILESYSTEM.text.name, (error, isDirectory) ->
				expect(error).to.not.exist
				expect(isDirectory).to.be.false
				done()

		it 'should return an error if the path doesn\'t exists', (done) ->
			fsUtils.isDirectory '/nonexistantpath', (error, isDirectory) ->
				expect(error).to.exist
				expect(isDirectory).to.be.undefined
				done()
