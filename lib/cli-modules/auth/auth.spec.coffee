expect = require('chai').expect
nock = require('nock')
auth = require('./auth')
config = require('../../config')
johnDoeFixture = require('../../../tests/fixtures/johndoe')

describe 'Auth', ->

	describe 'given valid credentials', ->

		beforeEach ->
			nock(config.baseUrl)
				.post('/login_', johnDoeFixture.credentials)
				.reply(200, johnDoeFixture.token)

		describe '#getToken()', ->

			it 'should return a token string', (done) ->
				auth.getToken johnDoeFixture.credentials, (error, token) ->
					return done(error) if error?
					expect(token).to.be.a('string')
					expect(token).to.equal(johnDoeFixture.token)
					done()

	describe 'given invalid credentials', ->

		beforeEach ->
			nock(config.baseUrl)
				.post('/login_')
				.reply(401)

		describe '#getToken()', ->

			it 'should return an error', (done) ->
				auth.getToken johnDoeFixture.credentials, (error, token) ->
					expect(error).to.exist
					expect(error).to.be.an.instanceof(Error)
					done()
