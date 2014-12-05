expect = require('chai').expect
mock = require('../../../../tests/utils/mock')
fsUtils = require('./fs-utils')
settings = require('../../settings')
data = require('../../data/data')

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
				settings.get('dataPrefix')
				'/Users/johndoe'
				'../parent'
				'./file/../file2'
			]
				expect(fsUtils.isValidPath(validPath)).to.be.true

	describe '#isDirectory()', ->

		FILESYSTEM =
			text:
				name: '/tmp/text'
				contents: 'Hello World'
			directory:
				name: '/tmp/directory'
				contents: {}

		beforeEach (done) ->
			mock.fs.init(FILESYSTEM)
			data.prefix.set(settings.get('dataPrefix'), done)

		afterEach ->
			mock.fs.restore()

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
