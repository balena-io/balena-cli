_ = require('lodash')
sinon = require('sinon')
chai = require('chai')
chai.use(require('chai-string'))
expect = chai.expect
cache = require('./cache')

describe 'Cache:', ->

	describe '#generateCacheName()', ->

		describe 'given network is ethernet', ->

			it 'should construct a correct name', ->
				application =
					id: 91
					params:
						network: 'ethernet'

				result = cache.generateCacheName(application.id, application.params)
				expect(result).to.match(new RegExp("#{application.id}-ethernet-\\d\+\$"))

		describe 'given network is wifi', ->
			it 'should construct a correct name', ->
				application =
					id: 91
					params:
						network: 'wifi'
						wifiSsid: 'MYSSID'

				result = cache.generateCacheName(application.id, application.params)
				expect(result).to.match(new RegExp("#{application.id}-wifi-#{application.params.wifiSsid}-\\d\+\$"))
