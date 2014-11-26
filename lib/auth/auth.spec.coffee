expect = require('chai').expect
nock = require('nock')
_ = require('lodash')
async = require('async')
auth = require('./auth')
resin = require('../resin')
config = require('../config')
mock = require('../../tests/utils/mock')
johnDoeFixture = require('../../tests/fixtures/johndoe')
janeDoeFixture = require('../../tests/fixtures/janedoe')

describe 'Auth:', ->

	before ->
		mock.connection.init()

	after ->
		mock.connection.restore()

	beforeEach (done) ->
		mock.fs.init()
		resin.data.prefix.set(config.dataPrefix, done)

	afterEach ->
		mock.fs.restore()

	describe 'given valid credentials', ->

		beforeEach ->
			nock(config.remoteUrl)
				.post('/login_', johnDoeFixture.credentials)
				.reply(200, johnDoeFixture.token)

		describe '#authenticate()', ->

			it 'should return a token string', (done) ->
				auth.authenticate johnDoeFixture.credentials, (error, token) ->
					return done(error) if error?
					expect(token).to.be.a('string')
					expect(token).to.equal(johnDoeFixture.token)
					done()

		describe '#login()', ->

			it 'should save the token', (done) ->
				async.waterfall [

					(callback) ->
						auth.isLoggedIn (isLoggedIn) ->
							return callback(null, isLoggedIn)

					(isLoggedIn, callback) ->
						expect(isLoggedIn).to.be.false
						auth.login(johnDoeFixture.credentials, callback)

					(callback) ->
						auth.isLoggedIn (isLoggedIn) ->
							return callback(null, isLoggedIn)

					(isLoggedIn, callback) ->
						expect(isLoggedIn).to.be.true
						return callback(null)

				], (error) ->
					expect(error).to.not.exist
					done()

	describe 'given invalid credentials', ->

		beforeEach ->
			nock(config.remoteUrl)
				.post('/login_')
				.reply(401)

		describe '#authenticate()', ->

			it 'should return an error', (done) ->
				auth.authenticate johnDoeFixture.credentials, (error, token) ->
					expect(error).to.exist
					expect(error).to.be.an.instanceof(Error)
					expect(token).to.be.undefined
					done()

		describe '#login()', ->

			it 'should return an error', (done) ->
				auth.login johnDoeFixture.credentials, (error, token) ->
					expect(error).to.exist
					expect(error).to.be.an.instanceof(Error)
					expect(token).to.be.undefined
					done()

	describe 'given a logged in user', ->

		beforeEach (done) ->
			nock(config.remoteUrl)
				.post('/login_', johnDoeFixture.credentials)
				.reply(200, johnDoeFixture.token)

			nock(config.remoteUrl)
				.post('/login_', janeDoeFixture.credentials)
				.reply(200, janeDoeFixture.token)

			auth.login(johnDoeFixture.credentials, done)

		describe '#login()', ->

			it 'should override the old user', (done) ->
				async.waterfall [

					(callback) ->
						auth.getToken(callback)

					(token, callback) ->
						expect(token).to.equal(johnDoeFixture.token)
						auth.login(janeDoeFixture.credentials, callback)

					(callback) ->
						auth.getToken(callback)

					(token, callback) ->
						expect(token).to.equal(janeDoeFixture.token)
						return callback(null)

				], (error) ->
					expect(error).to.not.exist
					done()

		describe '#isLoggedIn()', ->

			it 'should return true', (done) ->
				auth.isLoggedIn (isLoggedIn) ->
					expect(isLoggedIn).to.be.true
					done()

		describe '#getToken()', ->

			it 'should return the saved token', (done) ->
				auth.getToken (error, token) ->
					expect(error).to.not.exist
					expect(token).to.equal(johnDoeFixture.token)
					done()

		describe '#logout()', ->

			it 'should effectively logout the user', (done) ->
				async.waterfall [

					(callback) ->
						auth.isLoggedIn (isLoggedIn) ->
							return callback(null, isLoggedIn)

					(isLoggedIn, callback) ->
						expect(isLoggedIn).to.be.true
						auth.logout(callback)

					(callback) ->
						auth.isLoggedIn (isLoggedIn) ->
							return callback(null, isLoggedIn)

					(isLoggedIn, callback) ->
						expect(isLoggedIn).to.be.false
						auth.getToken(callback)

					(token, callback) ->
						expect(token).to.be.undefined
						return callback(null)

				], (error) ->
					expect(error).to.not.exist
					done()

	describe '#parseCredentials', ->

		describe 'given colon separated credentials', ->

			username = null
			password = null

			beforeEach ->
				username = 'johndoe'
				password = 'mysecret'

			it 'should parse the credentials correctly', (done) ->
				auth.parseCredentials "#{username}:#{password}", (error, credentials) ->
					expect(error).to.not.exist
					expect(credentials.username).to.equal(username)
					expect(credentials.password).to.equal(password)
					done()

			it 'should throw an error if it has two or more colons', (done) ->
				auth.parseCredentials "#{username}:#{password}:#{username}", (error, credentials) ->
					expect(error).to.be.an.instanceof(Error)
					expect(credentials).to.not.exist
					done()

			it 'should throw an error if only the username is passed', (done) ->
				auth.parseCredentials username, (error, credentials) ->
					expect(error).to.be.an.instanceof(Error)
					expect(credentials).to.not.exist
					done()
