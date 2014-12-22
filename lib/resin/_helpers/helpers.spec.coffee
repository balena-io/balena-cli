os = require('os')
chai = require('chai')
chai.use(require('chai-string'))
expect = chai.expect
path = require('path')
helpers = require('./helpers')

describe 'Helpers:', ->

	describe '#prefixObjectWithPath()', ->

		it 'should add the path to every value', ->
			prefix = "#{path.sep}resin"
			object =
				first: 'first'
				second: ".#{path.sep}second"

			result = helpers.prefixObjectValuesWithPath(prefix, object)

			for key, value of result
				expect(value).to.startsWith(prefix)

		it 'should not add the prefix if the paths are absolute', ->
			prefix = "#{path.sep}resin"

			if os.platform() is 'win32'
				object =
					first: 'C:\\first'
					second: 'C:\\Users\\me'
					third: 'C:\\'

			else
				object =
					first: '/first'
					second: '/home/second'
					third: '/usr/share/resin'
					fourth: '/'

			result = helpers.prefixObjectValuesWithPath(prefix, object)
			expect(result).to.deep.equal(object)
