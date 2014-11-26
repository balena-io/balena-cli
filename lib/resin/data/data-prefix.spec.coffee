expect = require('chai').expect
_ = require('lodash')
async = require('async')
fs = require('fs')
fsUtils = require('../../fs-utils/fs-utils')
rimraf = require('rimraf')
dataPrefix = require('./data-prefix')
config = require('../../config')
mock = require('../../../tests/utils/mock')

PREFIXES =
	main: config.dataPrefix
	new: "#{config.dataPrefix}-new"
	invalid: { path: '/abc' }

describe 'DataPrefix:', ->

	beforeEach ->
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
				rimraf(PREFIXES.main, done)

			it 'should be able to set a prefix', (done) ->
				expect(dataPrefix.get()).to.not.exist
				dataPrefix.set PREFIXES.main, (error) ->
					expect(error).to.not.exist
					expect(dataPrefix.get()).to.equal(PREFIXES.main)
					done()

			it 'should throw an error if passing an invalid path', (done) ->
				dataPrefix.set PREFIXES.invalid, (error) ->
					expect(error).to.be.an.instanceof(Error)
					done()

			it 'should create the directory if it doesn\'t exist', (done) ->

				async.waterfall [

					(callback) ->
						fs.exists PREFIXES.main, (exists) ->
							return callback(null, exists)

					(exists, callback) ->
						expect(exists).to.be.false
						dataPrefix.set(PREFIXES.main, callback)

					(callback) ->
						fsUtils.isDirectory(PREFIXES.main, callback)

					(isDirectory, callback) ->
						expect(isDirectory).to.be.true
						return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

	describe 'given a prefix', ->

		beforeEach (done) ->
			dataPrefix.set(PREFIXES.main, done)

		describe '#get()', ->

			it 'should return the saved prefix', ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)

		describe '#set()', ->

			it 'should be able to override the prefix', (done) ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)
				dataPrefix.set PREFIXES.new, (error) ->
					expect(error).to.not.exist
					expect(dataPrefix.get()).to.equal(PREFIXES.new)
					done()

		describe '#clear()', ->

			it 'should clear the prefix', ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)
				dataPrefix.clear()
				expect(dataPrefix.get()).to.not.exist
