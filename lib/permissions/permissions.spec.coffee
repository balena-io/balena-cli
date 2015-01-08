_ = require('lodash')
nock = require('nock')
sinon = require('sinon')
mockFs = require('mock-fs')
expect = require('chai').expect
resin = require('resin-sdk')
permissions = require('./permissions')
johnDoeFixture = require('../../tests/fixtures/johndoe')

describe 'Permissions:', ->

	describe '#user()', ->

		before ->
			@isOnlineStub = sinon.stub(resin.connection, 'isOnline')
			@isOnlineStub.yields(null, true)

		after ->
			@isOnlineStub.restore()

		beforeEach (done) ->
			mockFsOptions = {}
			mockFsOptions[resin.settings.get('dataPrefix')] = mockFs.directory()
			mockFs(mockFsOptions)

			resin.data.prefix.set(resin.settings.get('dataPrefix'), done)

		afterEach ->
			mockFs.restore()

		describe 'if not logged in', ->

			beforeEach (done) ->
				resin.auth.logout(done)

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

			beforeEach (done) ->
				nock(resin.settings.get('remoteUrl'))
					.post('/login_', johnDoeFixture.credentials)
					.reply(200, johnDoeFixture.token)

				resin.auth.login(johnDoeFixture.credentials, done)

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
