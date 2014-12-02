_ = require('lodash')
chai = require('chai')
expect = chai.expect
os = require('./os')

APPS =
	validEthernet:
		id: 91
		params:
			network: 'ethernet'
	invalidNetworkType:
		id: 91
		params:
			network: 'foobar'
	validWifi:
		id: 91
		params:
			network: 'wifi'
			wifiSsid: 'MYSSID'

describe 'OS:', ->

	describe '#generateCacheName()', ->

		describe 'given network is ethernet', ->

			it 'should construct a correct name', ->
				application = APPS.validEthernet
				result = os.generateCacheName(application.id, application.params)
				expect(result).to.equal("#{application.id}-ethernet-#{Date.now()}")

		describe 'given network is wifi', ->
			it 'should construct a correct name', ->
				application = APPS.validWifi
				result = os.generateCacheName(application.id, application.params)
				expect(result).to.equal("#{application.id}-wifi-#{application.params.wifiSsid}-#{Date.now()}")
