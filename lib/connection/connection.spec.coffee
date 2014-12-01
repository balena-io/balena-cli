expect = require('chai').expect
_ = require('lodash')
sinon = require('sinon')
connection = require('./connection')

CONNECTION_PARAMETERS =
	validEthernet:
		network: 'ethernet'
	validEthernetPlusExtra:
		network: 'ethernet'
		foo: 'bar'
		hello: 'world'
	validWifi:
		network: 'wifi'
		wifiSsid: 'mySsid'
		wifiKey: 'mySecret'
	ethernetAndWifiOptions:
		network: 'ethernet'
		wifiSsid: 'mySsid'
		wifiKey: 'mySecret'
	ethernetAndUndefinedWifi:
		network: 'ethernet'
		wifiSsid: undefined
		wifiKey: undefined
	wifiWithoutOptions:
		network: 'wifi'
	unknownWithOptions:
		network: 'foobar'
		wifiSsid: 'mySsid'
		wifiKey: 'mySecret'
	unknownWithoutOptions:
		network: 'foobar'

describe 'Connection:', ->

	describe '#isOnline()', ->

		stubIsOnline = (expectations, args...) ->
			isOnlineStub = sinon.stub(connection, 'isOnline')
			isOnlineStub.yields(args...)

			connection.isOnline (error, isOnline) ->
				expectations.apply(null, arguments)
				isOnlineStub.restore()

		it 'should be able to return true', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.not.exist
				expect(isOnline).to.be.true
				done()
			, null, true

		it 'should be able to return false', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.not.exist
				expect(isOnline).to.be.false
				done()
			, null, false

		it 'should be able to return an error', (done) ->
			stubIsOnline (error, isOnline) ->
				expect(error).to.be.an.instanceof(Error)
				expect(isOnline).to.not.exist
				done()
			, new Error()

	describe '#parseConnectionParameters()', ->

		checkParamsSuccess = (params, done) ->
			connection.parseConnectionParameters params, (error) ->
				expect(error).to.not.exist
				done()

		checkParamsFailure = (params, done) ->
			connection.parseConnectionParameters params, (error) ->
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should fail is parameters is empty', (done) ->
			checkParamsFailure({}, done)

		it 'should fail is parameters is not valid', (done) ->
			for input in [
				undefined
				null
				[ 1, 2 ]
				[]
				'string'
				true
			]
				checkParamsFailure(input, _.noop)
			done()

		describe 'if it succeeds', ->

			it 'should pass the parameters as the second argument', ->
				params = CONNECTION_PARAMETERS.validEthernet
				connection.parseConnectionParameters params, (error, parameters) ->
					expect(parameters).to.deep.equal(params)

			it 'should discard extra parameters', ->
				params = CONNECTION_PARAMETERS.validEthernetPlusExtra
				connection.parseConnectionParameters params, (error, parameters) ->
					expect(parameters).to.deep.equal(CONNECTION_PARAMETERS.validEthernet)

		describe 'if network is ethernet', ->

			it 'should succeed if no wifi options', (done) ->
				params = CONNECTION_PARAMETERS.validEthernet
				checkParamsSuccess(params, done)

			it 'should fail if it has wifi options', (done) ->
				params = CONNECTION_PARAMETERS.ethernetAndWifiOptions
				checkParamsFailure(params, done)

			it 'should discard undefined wifi related options', (done) ->
				params = CONNECTION_PARAMETERS.ethernetAndUndefinedWifi
				connection.parseConnectionParameters params, (error, result) ->
					expect(error).to.not.exist
					expect(result).to.deep.equal(network: 'ethernet')
					done()

		describe 'if network is wifi', ->

			it 'should succeed if has options', (done) ->
				params = CONNECTION_PARAMETERS.validWifi
				checkParamsSuccess(params, done)

			it 'should fail if missing options', (done) ->
				params = CONNECTION_PARAMETERS.wifiWithoutOptions
				checkParamsFailure(params, done)

		describe 'if network is unknown', ->

			it 'should fail with options', (done) ->
				params = CONNECTION_PARAMETERS.unknownWithOptions
				checkParamsFailure(params, done)

			it 'should fail without options', (done) ->
				params = CONNECTION_PARAMETERS.unknownWithoutOptions
				checkParamsFailure(params, done)
