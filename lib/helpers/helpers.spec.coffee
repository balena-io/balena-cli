expect = require('chai').expect
_ = require('lodash')
helpers = require('./helpers')

STRING =
	numbers: '1234567812345678'

describe 'Helpers:', ->

	describe '#formatLongString()', ->

		it 'should format a string', ->
			result = helpers.formatLongString(STRING.numbers, 4)
			expect(result).to.equal('1234\n5678\n1234\n5678')

		it 'should return the same string if n is null/undefined', ->
			for value in [ undefined, null ]
				result = helpers.formatLongString(STRING.numbers, value)
				expect(result).to.equal(STRING.numbers)

		it 'should throw an error if input is not a string', ->
			for value in [
				undefined
				null
				[]
				{}
				123
			]
				fn = _.partial(helpers.formatLongString, value, 4)
				expect(fn).to.throw

		it 'should return the same string if n > string.length', ->
			stringLength = STRING.numbers.length
			result = helpers.formatLongString(STRING.numbers, stringLength + 1)
			expect(result).to.equal(STRING.numbers)
