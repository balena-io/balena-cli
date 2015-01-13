_ = require('lodash')
sinon = require('sinon')
expect = require('chai').expect
resin = require('resin-sdk')
permissions = require('./permissions')

describe 'Permissions:', ->

	describe '#user()', ->

		describe 'if not logged in', ->

			beforeEach ->
				@isLoggedInStub = sinon.stub(resin.auth, 'isLoggedIn')
				@isLoggedInStub.yields(false)

			afterEach ->
				@isLoggedInStub.restore()

			it 'should not call the function', (done) ->
				spy = sinon.spy()
				permissions.user(spy, _.noop)()

				_.defer ->
					expect(spy).to.not.have.been.called
					done()

			it 'it should call the second function with an error', (done) ->
				func = permissions.user _.noop, (error) ->
					expect(error).to.be.an.instanceof(Error)
					done()
				func()

		describe 'if logged in', ->

			beforeEach ->
				@isLoggedInStub = sinon.stub(resin.auth, 'isLoggedIn')
				@isLoggedInStub.yields(true)

			afterEach ->
				@isLoggedInStub.restore()

			it 'should call the function with the correct arguments', (done) ->
				args = [ 1, 2, 3, 'foo', 'bar' ]

				spy = sinon.spy()
				permissions.user(spy, _.noop).apply(null, args)

				_.defer ->
					expect(spy).to.have.been.calledWith(args...)
					done()

			it 'should not call the second function', (done) ->
				spy = sinon.spy()
				permissions.user(_.noop, spy)()

				_.defer ->
					expect(spy).to.not.have.been.called
					done()
