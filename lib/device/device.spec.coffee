expect = require('chai').expect
device = require('./device')

describe 'Device:', ->

	describe '#getDisplayName()', ->

		it 'should return Raspberry Pi for that device', ->
			displayName = 'Raspberry Pi'

			possibleNames = [
				'raspberry-pi'
				'raspberrypi'
				'rpi'
			]

			for name in possibleNames
				expect(device.getDisplayName(name)).to.equal(displayName)
