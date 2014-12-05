_ = require('lodash')
nock = require('nock')
sinon = require('sinon')
expect = require('chai').expect
data = require('../data/data')
auth = require('../auth/auth')
settings = require('../settings')
cliPermissions = require('./cli-permissions')
johnDoeFixture = require('../../../tests/fixtures/johndoe')
mock = require('../../../tests/utils/mock')

describe 'CLI Permissions:', ->

	describe '#user()', ->

		before ->
			mock.connection.init()

		after ->
			mock.connection.restore()

		beforeEach (done) ->
			mock.fs.init()
			data.prefix.set(settings.get('dataPrefix'), done)

		afterEach ->
			mock.fs.restore()

		describe 'if not logged in', ->

			beforeEach (done) ->
				auth.logout(done)

			it 'should not call the function', (done) ->
				spy = sinon.spy()
				cliPermissions.user(spy, _.noop)()

				_.defer ->
					expect(spy).to.not.have.been.called
					done()

			it 'it should call the second function with an error', (done) ->
				func = cliPermissions.user _.noop, (error) ->
					expect(error).to.be.an.instanceof(Error)
					done()
				func()

			# TODO: expect(func).to.throw(Error) doesn't catches
			# the error as it's being thrown inside an async function
			# (auth.isLoggedIn). A try/catch works, but it still results
			# in the error being printed in Mocha reporter.
			xit 'should throw an error if no error handler function', ->
				func = cliPermissions.user(_.noop)
				try
					func()
				catch error
					expect(error).to.be.an.instanceof(Error)

		describe 'if logged in', ->

			beforeEach (done) ->
				nock(settings.get('remoteUrl'))
					.post('/login_', johnDoeFixture.credentials)
					.reply(200, johnDoeFixture.token)

				auth.login(johnDoeFixture.credentials, done)

			it 'should call the function with the correct arguments', (done) ->
				args = [ 1, 2, 3, 'foo', 'bar' ]

				spy = sinon.spy()
				cliPermissions.user(spy, _.noop).apply(null, args)

				_.defer ->
					expect(spy).to.have.been.calledWith(args...)
					done()

			it 'should not call the second function', (done) ->
				spy = sinon.spy()
				cliPermissions.user(_.noop, spy)()

				_.defer ->
					expect(spy).to.not.have.been.called
					done()
