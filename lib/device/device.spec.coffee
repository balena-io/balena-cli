_ = require('lodash')
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

	describe '#getDeviceSlug()', ->

		it 'should return valid slugs', ->
			for key, value in DEVICES
				expect(device.getDeviceSlug(key)).to.equal(value.slug)

		it 'should return unknown if not valid device', ->
			result = device.getDeviceSlug('Foo Bar')
			expect(result).to.equal('unknown')

		it 'should return a valid slug if using an alternative name', ->
			for key, value in DEVICES
				name = _.first(value.names)
				expect(device.getDeviceSlug(name)).to.equal(value.slug)

	describe '#getSupportedDevices()', ->

		it 'should return an array', ->
			expect(device.getSupportedDevices()).to.be.an.instanceof(Array)

		it 'should have every supported device', ->
			supportedDevices = device.getSupportedDevices()
			for key, value in DEVICES
				expect(supportedDevices.indexOf(key)).to.not.equal(-1)
