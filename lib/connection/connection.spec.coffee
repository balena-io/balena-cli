expect = require('chai').expect
_ = require('lodash')
sinon = require('sinon')
connection = require('./connection')

describe 'Connection:', ->

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
				params =
					network: 'ethernet'

				connection.parseConnectionParameters params, (error, parameters) ->
					expect(parameters).to.deep.equal(params)

			it 'should discard extra parameters', ->
				params =
					network: 'ethernet'
					foo: 'bar'
					hello: 'world'

				connection.parseConnectionParameters params, (error, parameters) ->
					expect(parameters).to.deep.equal(network: 'ethernet')

		describe 'if network is ethernet', ->

			it 'should succeed if no wifi options', (done) ->
				params =
					network: 'ethernet'

				checkParamsSuccess(params, done)

			it 'should fail if it has wifi options', (done) ->
				params =
					network: 'ethernet'
					wifiSsid: 'mySsid'
					wifiKey: 'mySecret'

				checkParamsFailure(params, done)

			it 'should discard undefined wifi related options', (done) ->
				params =
					network: 'ethernet'
					wifiSsid: undefined
					wifiKey: undefined

				connection.parseConnectionParameters params, (error, result) ->
					expect(error).to.not.exist
					expect(result).to.deep.equal(network: 'ethernet')
					done()

		describe 'if network is wifi', ->

			it 'should succeed if has options', (done) ->
				params =
					network: 'wifi'
					wifiSsid: 'mySsid'
					wifiKey: 'mySecret'

				checkParamsSuccess(params, done)

			it 'should fail if missing options', (done) ->
				params =
					network: 'wifi'

				checkParamsFailure(params, done)

		describe 'if network is unknown', ->

			it 'should fail with options', (done) ->
				params =
					network: 'foobar'
					wifiSsid: 'mySsid'
					wifiKey: 'mySecret'

				checkParamsFailure(params, done)

			it 'should fail without options', (done) ->
				params =
					network: 'foobar'

				checkParamsFailure(params, done)
