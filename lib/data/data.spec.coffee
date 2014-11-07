expect = require('chai').expect
_ = require('lodash')
mockFs = require('mock-fs')
data = require('./data')

PREFIX = '~/.resin'

FILES_FIXTURES =
	hello:
		filename: 'hello_world.test'
		contents: 'Hello World!'
	nested:
		filename: 'nested/hello_world.test'
		contents: 'Nested Hello World!'

FILESYSTEM =
	text:
		name: "#{PREFIX}/text"
		contents: 'Hello World'
		key: 'text'
	directory:
		name: "#{PREFIX}/directory"
		contents: mockFs.directory()
		key: 'directory'
	nested:
		name: "#{PREFIX}/nested/text"
		contents: 'Nested Hello World'
		key: 'nested/text'

describe 'Data:', ->

	describe 'given no prefix', ->

		describe '#get()', ->

			it 'should throw an error', ->
				getDataKey = _.partial(data.get, 'foobar')
				expect(getDataKey).to.throw(Error)

		describe '#set()', ->

			it 'should throw an error', ->
				setDataKey = _.partial(data.set, 'foobar', 'Foo Bar!')
				expect(setDataKey).to.throw(Error)

	describe 'given a prefix', ->

		beforeEach ->
			mockFsOptions = {}
			for key, value of FILESYSTEM
				mockFsOptions[value.name] = value.contents
			mockFs(mockFsOptions)

			data.prefix.set(PREFIX)

		afterEach ->
			mockFs.restore()
			data.prefix.clear()

		describe '#get()', ->

			it 'should be able to read a valid key', (done) ->
				data.get FILESYSTEM.text.key, encoding: 'utf8', (error, value) ->
					expect(error).to.not.exist
					expect(value).to.equal(FILESYSTEM.text.contents)
					done()

			it 'should be able to read a nested key', (done) ->
				data.get FILESYSTEM.nested.key, encoding: 'utf8', (error, value) ->
					expect(error).to.not.exist
					expect(value).to.equal(FILESYSTEM.nested.contents)
					done()

			it 'should return an error if reading an invalid key', (done) ->
				data.get 'nonexistantkey', encoding: 'utf8', (error, value) ->
					expect(error).to.be.an.instanceof(Error)
					expect(value).to.not.exist
					done()

			it 'should return an error if not reading a file', (done) ->
				data.get FILESYSTEM.directory.key, encoding: 'utf8', (error, value) ->
					expect(error).to.be.an.instanceof(Error)
					expect(value).to.not.exist
					done()

		describe '#set()', ->

			it 'should be able to write a file', (done) ->
				filename = FILES_FIXTURES.hello.filename
				contents = FILES_FIXTURES.hello.contents

				data.get filename, encoding: 'utf8', (error, value) ->
					expect(error).to.be.an.instanceof(Error)
					expect(value).to.not.exist

					data.set filename, contents, encoding: 'utf8', (error) ->
						expect(error).to.not.exist

						data.get filename, encoding: 'utf8', (error, value) ->
							expect(error).to.not.exist
							expect(value).to.equal(contents)
							done()

			it 'should be able to write a nested file', (done) ->
				filename = FILES_FIXTURES.nested.filename
				contents = FILES_FIXTURES.nested.contents

				data.get filename, encoding: 'utf8', (error, value) ->
					expect(error).to.be.an.instanceof(Error)
					expect(value).to.not.exist

					data.set filename, contents, encoding: 'utf8', (error) ->
						expect(error).to.not.exist

						data.get filename, encoding: 'utf8', (error, value) ->
							expect(error).to.not.exist
							expect(value).to.equal(contents)
							done()
