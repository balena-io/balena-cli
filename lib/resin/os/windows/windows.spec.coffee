fs = require('fs')
chai = require('chai')
expect = chai.expect
windows = require('./windows')

describe 'OS Windows:', ->

	describe '#parseWmicDiskDriveGet()', ->

		beforeEach ->
			@wmicOutput = [
				'Caption                           DeviceID            \r\r'
				'WDC WD10JPVX-75JC3T0              \\\\.\\PHYSICALDRIVE0  \r\r'
				'Generic STORAGE DEVICE USB Device \\\\.\\PHYSICALDRIVE1  \r\r'
				'\r\r'
				''
			].join('\n')

		it 'should parse the output', ->
			result = windows.parseWmicDiskDriveGet(@wmicOutput)

			expect(result).to.deep.equal [
				{ caption: 'WDC WD10JPVX-75JC3T0', id: '\\\\.\\PHYSICALDRIVE0' }
				{ caption: 'Generic STORAGE DEVICE USB Device', id: '\\\\.\\PHYSICALDRIVE1' }
			]
