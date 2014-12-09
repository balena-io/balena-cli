expect = require('chai').expect
_ = require('lodash')
fsPlus = require('fs-plus')
sinon = require('sinon')
mock = require('../../../tests/utils/mock')
async = require('async')
settings = require('../settings')
data = require('./data')

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

		describe '#remove()', ->

			it 'should throw an error', ->
				removeDataKey = _.partial(data.remove, 'foobar')
				expect(removeDataKey).to.throw(Error)

		describe '#has()', ->

			it 'should throw an error', ->
				hasDataKey = _.partial(data.has, 'foobar')
				expect(hasDataKey).to.throw(Error)

	describe 'given a prefix', ->

		FILESYSTEM =
			text:
				name: "#{settings.get('dataPrefix')}/text"
				contents: 'Hello World'
				key: 'text'
			directory:
				name: "#{settings.get('dataPrefix')}/directory"
				contents: {}
				key: 'directory'
			nested:
				name: "#{settings.get('dataPrefix')}/nested/text"
				contents: 'Nested Hello World'
				key: 'nested/text'

		beforeEach (done) ->
			mock.fs.init(FILESYSTEM)
			data.prefix.set(settings.get('dataPrefix'), done)

		afterEach ->
			mock.fs.restore()
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

			it 'should return undefined if reading an invalid key', (done) ->
				data.get 'nonexistantkey', encoding: 'utf8', (error, value) ->
					expect(error).to.not.exist
					expect(value).to.be.undefined
					done()

			it 'should return an error if not reading a file', (done) ->
				data.get FILESYSTEM.directory.key, encoding: 'utf8', (error, value) ->
					expect(error).to.be.an.instanceof(Error)
					expect(value).to.not.exist
					done()

			it 'should return undefined if key doesn\'t exists', (done) ->
				data.get 'nontexistantkey', encoding: 'utf8', (error, value) ->
					expect(error).to.not.exist
					expect(value).to.be.undefined
					done()

		describe '#getText()', ->

			it 'should be able to read a valid key', (done) ->
				data.getText FILESYSTEM.text.key, (error, value) ->
					expect(error).to.not.exist
					expect(value).to.equal(FILESYSTEM.text.contents)
					done()

			it 'should call get(), assumming utf8 encoding', (done) ->
				mock.fs.restore()
				dataGetSpy = sinon.spy(data, 'get')
				mock.fs.init(FILESYSTEM)

				key = FILESYSTEM.text.key

				callback = (error, value) ->
					expect(dataGetSpy).to.have.been.called
					expect(dataGetSpy).to.have.been.calledWith(key, encoding: 'utf8', callback)
					dataGetSpy.restore()
					done()

				data.getText(key, callback)

		describe '#has()', ->

			it 'should return true if a file exists', (done) ->
				data.has FILESYSTEM.text.key, (hasKey) ->
					expect(hasKey).to.be.true
					done()

			it 'should return true if a directory exists', (done) ->
				data.has FILESYSTEM.directory.key, (hasKey) ->
					expect(hasKey).to.be.true
					done()

			it 'should return false if the file doesn\'t exists', (done) ->
				data.has 'foobar', (hasKey) ->
					expect(hasKey).to.be.false
					done()

		describe '#set()', ->

			writeAndCheckFixture = (fixture) ->
				return (done) ->
					filename = fixture.filename
					contents = fixture.contents

					async.waterfall [

						(callback) ->
							data.get filename, encoding: 'utf8', (error, value) ->
								expect(error).to.not.exist
								expect(value).to.be.undefined
								return callback()

						(callback) ->
							data.set(filename, contents, encoding: 'utf8', callback)

						(callback) ->
							data.get(filename, encoding: 'utf8', callback)

						(value, callback) ->
							expect(value).to.equal(contents)
							return callback()

					], (error) ->
						expect(error).to.not.exist
						done()

			FILES_FIXTURES =
				hello:
					filename: 'hello_world.test'
					contents: 'Hello World!'
				nested:
					filename: 'nested/hello_world.test'
					contents: 'Nested Hello World!'

			it('should be able to write a file', writeAndCheckFixture(FILES_FIXTURES.hello))
			it('should be able to write a nested file', writeAndCheckFixture(FILES_FIXTURES.nested))

		describe '#setText()', ->

			it 'should call set(), assumming utf8 encoding', (done) ->
				mock.fs.restore()
				dataSetSpy = sinon.spy(data, 'set')
				mock.fs.init(FILESYSTEM)

				key = FILESYSTEM.text.key
				contents = 'Hello World'

				callback = (error, value) ->
					expect(dataSetSpy).to.have.been.called
					expect(dataSetSpy).to.have.been.calledWith(key, contents, encoding: 'utf8', callback)
					dataSetSpy.restore()
					done()

				data.setText(key, contents, callback)

		describe '#remove()', ->

			removeAndCheckFile = (file) ->
				return (done) ->
					key = file.key

					async.waterfall [

						(callback) ->
							data.get(key, encoding: 'utf8', callback)

						(value, callback) ->
							expect(value).to.equal(file.contents)
							data.remove(key, callback)

						(callback) ->
							data.get key, encoding: 'utf8', (error, value) ->
								expect(error).to.not.exist
								expect(value).to.be.undefined
								return callback()

					], (error) ->
						expect(error).to.not.exist
						done()

			it('should be able to remove a file', removeAndCheckFile(FILESYSTEM.text))

			it('should be able to remove a nested file', removeAndCheckFile(FILESYSTEM.nested))

			it 'should be able to remove a directory', (done) ->
				directory = FILESYSTEM.directory

				async.waterfall [

					(callback) ->
						fsPlus.isDirectory directory.name, (isDirectory) ->
							return callback(null, isDirectory)

					(isDirectory, callback) ->
						expect(isDirectory).to.be.true
						data.remove(directory.key, callback)

					(callback) ->
						data.has directory.key, (hasKey) ->
							expect(hasKey).to.be.false
							return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

			it 'should return an error if key is invalid', (done) ->
				data.remove [ 1, 2, 3 ], (error) ->
					expect(error).to.be.an.instanceof(Error)
					done()
