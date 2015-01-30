chai = require('chai')
expect = chai.expect
sinon = require('sinon')
chai.use(require('sinon-chai'))
childProcess = require('child_process')
osx = require('./osx')

describe 'Drive OSX:', ->

	describe 'given correct output from diskdrive', ->

		beforeEach ->
			@childProcessStub = sinon.stub(childProcess, 'exec')
			@childProcessStub.yields null, '''
				/dev/disk0
					 #:                       TYPE NAME                    SIZE       IDENTIFIER
					 0:      GUID_partition_scheme                        *750.2 GB   disk0
					 1:                        EFI EFI                     209.7 MB   disk0s1
					 2:          Apple_CoreStorage                         749.3 GB   disk0s2
					 3:                 Apple_Boot Recovery HD             650.0 MB   disk0s3
				/dev/disk1
					 #:                       TYPE NAME                    SIZE       IDENTIFIER
					 0:                  Apple_HFS Macintosh HD           *748.9 GB   disk1
																				 Logical Volume on disk0s2
																				 3D74D961-80FB-4DB1-808F-8B5800C53E3A
																				 Unlocked Encrypted
				/dev/disk2
					 #:                       TYPE NAME                    SIZE       IDENTIFIER
					 0:                            elementary OS          *15.7 GB    disk2
			''', undefined

		afterEach ->
			@childProcessStub.restore()

		it 'should extract the necessary information', (done) ->
			osx.list (error, drives) ->
				expect(error).to.not.exist

				expect(drives).to.deep.equal [
					{
						device: '/dev/disk0'
						description: 'GUID_partition_scheme'
						size: '*750.2 GB'
					}
					{
						device: '/dev/disk1'
						description: 'Apple_HFS Macintosh HD'
						size: '*748.9 GB'
					}
					{
						device: '/dev/disk2'
						description: 'elementary OS'
						size: '*15.7 GB'
					}
				]

				return done()
