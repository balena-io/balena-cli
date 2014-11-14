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

			it 'should be able to set a prefix', ->
				expect(dataPrefix.get()).to.not.exist
				dataPrefix.set(PREFIXES.main)
				expect(dataPrefix.get()).to.equal(PREFIXES.main)

			it 'should throw an error if passing an invalid path', ->
				setInvalidPrefix = _.partial(dataPrefix.set, PREFIXES.invalid)
				expect(setInvalidPrefix).to.throw(Error)

	describe 'given a prefix', ->

		beforeEach ->
			dataPrefix.set(PREFIXES.main)

		describe '#get()', ->

			it 'should return the saved prefix', ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)

		describe '#set()', ->

			it 'should be able to override the prefix', ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)
				dataPrefix.set(PREFIXES.new)
				expect(dataPrefix.get()).to.equal(PREFIXES.new)

		describe '#clear()', ->

			it 'should clear the prefix', ->
				expect(dataPrefix.get()).to.equal(PREFIXES.main)
				dataPrefix.clear()
				expect(dataPrefix.get()).to.not.exist
