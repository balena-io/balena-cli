expect = require('chai').expect
_ = require('lodash')
sinon = require('sinon')
connection = require('./connection')

describe 'Connection:', ->

	describe '#isOnline()', ->

		stubIsOnline = (expectations, args...) ->
			isOnlineStub = sinon.stub(connection, 'isOnline')
			isOnlineStub.yields(args...)

			connection.isOnline (error, isOnline) ->
				expectations.apply(null, arguments)
				isOnlineStub.restore()

		it 'should be able to return true', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.not.exist
				expect(isOnline).to.be.true
				done()
			, null, true

		it 'should be able to return false', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.not.exist
				expect(isOnline).to.be.false
				done()
			, null, false

		it 'should be able to return an error', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.be.an.instanceof(Error)
				expect(isOnline).to.not.exist
				done()
			, new Error()
