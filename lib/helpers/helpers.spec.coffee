expect = require('chai').expect
sinon = require('sinon')
_ = require('lodash')
helpers = require('./helpers')
resin = require('resin-sdk')

describe 'Helpers:', ->

	describe '#parseCredentials', ->

		describe 'given colon separated credentials', ->

			username = null
			password = null

			beforeEach ->
				username = 'johndoe'
				password = 'mysecret'

			it 'should parse the credentials correctly', (done) ->
				helpers.parseCredentials "#{username}:#{password}", (error, credentials) ->
					expect(error).to.not.exist
					expect(credentials.username).to.equal(username)
					expect(credentials.password).to.equal(password)
					done()

			it 'should throw an error if it has two or more colons', (done) ->
				helpers.parseCredentials "#{username}:#{password}:#{username}", (error, credentials) ->
					expect(error).to.be.an.instanceof(Error)
					expect(credentials).to.not.exist
					done()

			it 'should throw an error if only the username is passed', (done) ->
				helpers.parseCredentials username, (error, credentials) ->
					expect(error).to.be.an.instanceof(Error)
					expect(credentials).to.not.exist
					done()
