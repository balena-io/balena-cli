expect = require('chai').expect
_ = require('lodash')
async = require('async')
fs = require('fs')
fsPlus = require('fs-plus')
rimraf = require('rimraf')
dataPrefix = require('./data-prefix')
settings = require('../settings')
mock = require('../../../tests/utils/mock')

describe 'DataPrefix:', ->

	beforeEach ->
		@prefix = settings.get('dataPrefix')
		mock.fs.init()

	afterEach ->
		mock.fs.restore()

	describe 'given no prefix', ->

		beforeEach ->
			dataPrefix.clear()

		describe '#get()', ->

			it 'should return nothing', ->
				expect(dataPrefix.get()).to.not.exist

		describe '#set()', ->

			beforeEach (done) ->
				rimraf(@prefix, done)

			it 'should be able to set a prefix', (done) ->
				expect(dataPrefix.get()).to.not.exist
				dataPrefix.set @prefix, (error) =>
					expect(error).to.not.exist
					expect(dataPrefix.get()).to.equal(@prefix)
					done()

			it 'should throw an error if passing an invalid path', (done) ->
				dataPrefix.set { path: '/abc' }, (error) ->
					expect(error).to.be.an.instanceof(Error)
					done()

			it 'should create the directory if it doesn\'t exist', (done) ->

				async.waterfall [

					(callback) ->
						fs.exists @prefix, (exists) ->
							return callback(null, exists)

					(exists, callback) =>
						expect(exists).to.be.false
						dataPrefix.set(@prefix, callback)

					(callback) =>
						fsPlus.isDirectory @prefix, (isDirectory) ->
							return callback(null, isDirectory)

					(isDirectory, callback) ->
						expect(isDirectory).to.be.true
						return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

	describe 'given a prefix', ->

		beforeEach (done) ->
			dataPrefix.set(@prefix, done)

		describe '#get()', ->

			it 'should return the saved prefix', ->
				expect(dataPrefix.get()).to.equal(@prefix)

		describe '#set()', ->

			it 'should be able to override the prefix', (done) ->
				newPrefix = "#{settings.get('dataPrefix')}-new"
				expect(dataPrefix.get()).to.equal(@prefix)
				dataPrefix.set newPrefix, (error) ->
					expect(error).to.not.exist
					expect(dataPrefix.get()).to.equal(newPrefix)
					done()

		describe '#clear()', ->

			it 'should clear the prefix', ->
				expect(dataPrefix.get()).to.equal(@prefix)
				dataPrefix.clear()
				expect(dataPrefix.get()).to.not.exist
