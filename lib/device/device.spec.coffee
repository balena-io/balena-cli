expect = require('chai').expect
device = require('./device')
DEVICES = require('./device-data.json')

describe 'Device:', ->

	describe '#getDisplayName()', ->

		it 'should return Raspberry Pi for that device', ->
			possibleNames = [
				'raspberry-pi'
				'raspberrypi'
				'rpi'
			]

			for name in possibleNames
				expect(device.getDisplayName(name)).to.equal('Raspberry Pi')

		it 'should return unknown if no matches', ->
			unknownNames = [
				'hello'
				'foobar'
				{}
				123
			]

			for name in unknownNames
				expect(device.getDisplayName(name)).to.equal('Unknown')

	describe '#getSupportedDevices()', ->

		result = null

		beforeEach ->
			result = device.getSupportedDevices()

		it 'should return an array', ->
			expect(result).to.be.an.instanceof(Array)

		it 'should return all slugs', ->
			for device in DEVICES
				expect(result.indexOf(device.slug)).to.not.equal(-1)
