expect = require('chai').expect
sinon = require('sinon')
_ = require('lodash')
helpers = require('./helpers')
resin = require('../resin')

describe 'Helpers:', ->

	describe '#isDeviceUUIDValid()', ->

		devices = [
			{ uuid: 1234 }
			{ uuid: 5678 }
		]

		deviceGetAllStub = null

		beforeEach ->
			deviceGetAllStub = sinon.stub(resin.models.device, 'getAll')
			deviceGetAllStub.yields(null, devices)

		afterEach ->
			deviceGetAllStub.restore()

		it 'should return true if there is a device with that UUID', (done) ->
			helpers.isDeviceUUIDValid devices[0].uuid, (error, isValid) ->
				expect(error).to.not.exist
				expect(isValid).to.be.true
				done()

		it 'should return false if there is not a device with that UUID', (done) ->
			helpers.isDeviceUUIDValid 'invalidUUID', (error, isValid) ->
				expect(error).to.not.exist
				expect(isValid).to.be.false
				done()

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
