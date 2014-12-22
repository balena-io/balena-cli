expect = require('chai').expect
errors = require('./errors')

describe 'Errors:', ->

	describe 'NotFound', ->

		it 'should get a custom message', ->
			message = 'Foo'
			error = new errors.NotFound(message)
			expect(error.message).to.not.equal(message)
			expect(error.message).to.contain(message)
