expect = require('chai').expect
sinon = require('sinon')
_ = require('lodash')
helpers = require('./helpers')
resin = require('../resin')

describe 'Helpers:', ->

	describe '#formatLongString()', ->

		it 'should format a string', ->
			result = helpers.formatLongString('1234567812345678', 4)
			expect(result).to.equal('1234\n5678\n1234\n5678')

		it 'should return the same string if n is null/undefined', ->
			for value in [ undefined, null ]
				result = helpers.formatLongString('1234567890', value)
				expect(result).to.equal('1234567890')

		it 'should throw an error if input is not a string', ->
			for value in [
				undefined
				null
				[]
				{}
				123
			]
				fn = _.partial(helpers.formatLongString, value, 4)
				expect(fn).to.throw

		it 'should return the same string if n > string.length', ->
			string = '1234567812345678'
			result = helpers.formatLongString(string, string.length + 1)
			expect(result).to.equal(string)

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
