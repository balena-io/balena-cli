chai = require('chai')
expect = chai.expect
sinon = require('sinon')
chai.use(require('sinon-chai'))
childProcess = require('child_process')
linux = require('./linux')

describe 'Drive LINUX:', ->

	describe 'given correct output from lsblk', ->

		beforeEach ->
			@childProcessStub = sinon.stub(childProcess, 'exec')
			@childProcessStub.yields null, '''
				NAME MODEL              SIZE
				sda  WDC WD10JPVX-75J 931,5G
				sdb  STORAGE DEVICE    14,7G
				sr0  DVD+-RW GU90N     1024M
			''', undefined

		afterEach ->
			@childProcessStub.restore()

		it 'should extract the necessary information', (done) ->
			linux.list (error, drives) ->
				expect(error).to.not.exist

				expect(drives).to.deep.equal [
					{
						device: '/dev/sda'
						description: 'WDC WD10JPVX-75J'
						size: '931.5G'
					}
					{
						device: '/dev/sdb'
						description: 'STORAGE DEVICE'
						size: '14.7G'
					}
					{
						device: '/dev/sr0'
						description: 'DVD+-RW GU90N'
						size: '1024M'
					}
				]

				return done()
