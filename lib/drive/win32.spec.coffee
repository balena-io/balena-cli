chai = require('chai')
expect = chai.expect
sinon = require('sinon')
chai.use(require('sinon-chai'))
childProcess = require('child_process')
win32 = require('./win32')

describe 'Drive WIN32:', ->

	describe 'given correct output from wmic', ->

		beforeEach ->
			@childProcessStub = sinon.stub(childProcess, 'exec')
			@childProcessStub.yields null, '''
				Caption                            DeviceID               Size
				WDC WD10JPVX-75JC3T0               \\\\.\\PHYSICALDRIVE0  1000202273280
				Generic STORAGE DEVICE USB Device  \\\\.\\PHYSICALDRIVE1  15718510080
			''', undefined

		afterEach ->
			@childProcessStub.restore()

		it 'should extract the necessary information', (done) ->
			win32.list (error, drives) ->
				expect(error).to.not.exist

				expect(drives).to.deep.equal [
					{
						device: '\\\\.\\PHYSICALDRIVE0'
						description: 'WDC WD10JPVX-75JC3T0'
						size: '1000 GB'
					}
					{
						device: '\\\\.\\PHYSICALDRIVE1'
						description: 'Generic STORAGE DEVICE USB Device'
						size: '15 GB'
					}
				]

				return done()
