expect = require('chai').expect
_ = require('lodash')
dataPrefix = require('./data-prefix')
config = require('../config')

PREFIXES =
	main: config.dataPrefix
	new: "#{config.dataPrefix}-new"
	invalid: { path: '/abc' }

describe 'DataPrefix:', ->

	describe 'given no prefix', ->

		beforeEach ->
			dataPrefix.clear()

		describe '#get()', ->

			it 'should return nothing', ->
				expect(dataPrefix.get()).to.not.exist

		describe '#set()', ->

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
