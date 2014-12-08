chai = require('chai')
chai.use(require('chai-string'))
expect = chai.expect
helpers = require('./helpers')

describe 'Helpers:', ->

	describe '#prefixObjectWithPath()', ->

		it 'should add the path to every value', ->
			prefix = '/resin'
			object =
				first: 'first'
				second: './second'

			result = helpers.prefixObjectValuesWithPath(prefix, object)

			for key, value of result
				expect(value).to.startsWith(prefix)

		it 'should not add the prefix if the paths are absolute', ->
			prefix = '/resin'
			object =
				first: '/first'
				second: '/home/second'
				third: '/usr/share/resin'
				fourth: '/'

			result = helpers.prefixObjectValuesWithPath(prefix, object)
			expect(result).to.deep.equal(object)
