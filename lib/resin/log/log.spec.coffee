_ = require('lodash')
chai = require('chai')
chai.use(require('sinon-chai'))
expect = chai.expect
sinon = require('sinon')
log = require('./log')

describe 'Log:', ->

	testConsoleFunction = (logName, consoleName, message, assertions) ->
		spy = sinon.spy(console, consoleName)
		log[logName](message)
		assertions(spy)
		console[consoleName].restore()

	testConsoleFunctionBeingCalled = (logName, consoleName, message) ->
		testConsoleFunction logName, consoleName, message, (spy) ->
			expect(spy).to.have.been.calledOnce
			expect(spy).to.have.been.calledWith(message)

	testConsoleFunctionNotBeingCalled = (logName, consoleName, message) ->
		testConsoleFunction logName, consoleName, message, (spy) ->
			expect(spy).to.not.have.been.called

	describe 'if quiet is false', ->

		beforeEach ->
			log.setQuiet(false)

		describe '#error()', ->

			it 'should output to console.error', ->
				testConsoleFunctionBeingCalled('error', 'error', '')

		describe '#warning()', ->

			it 'should output to console.warn', ->
				testConsoleFunctionBeingCalled('warning', 'warn', '')

		describe '#info()', ->

			it 'should output to console.info', ->
				testConsoleFunctionBeingCalled('info', 'info', '')

		describe '#out()', ->

			it 'should output to console.log', ->
				testConsoleFunctionBeingCalled('out', 'log', '')

		describe '#array()', ->

			array = [ 1, 2, 3, 4 ]

			it 'should call log function for every line', ->
				spy = sinon.spy()
				log.array(array, spy)
				expect(spy.callCount).to.equal(array.length)

				for item in array
					expect(spy).to.have.been.calledWith(item)

			it 'should throw an error if log function is missing', ->
				func = _.partial(log.array, array)
				expect(func).to.throw(Error)

			it 'should throw an error if log function is not a function', ->
				for input in [
					undefined
					null
					123
					'Hello World'
					[ 1, 2, 3 ]
					{ hello: 'world' }
				]
					func = _.partial(log.array, 'Hello', input)
					expect(func).to.throw(Error)

			it 'should call log function once if input is not an array', ->
				for input in [
					'Hello World'
					{ hello: 'world' }
					1234
				]
					spy = sinon.spy()
					log.array(input, spy)
					expect(spy).to.have.been.calledOnce
					expect(spy).to.have.been.calledWith(input)

			it 'should not call log function if input is undefined/null', ->
				for input in [
					undefined
					null
				]
					spy = sinon.spy()
					log.array(input, spy)
					expect(spy).to.not.have.been.called

		describe '#setQuiet()', ->

			it 'should set the quietness', ->
				expect(log.isQuiet()).to.be.false
				log.setQuiet(true)
				expect(log.isQuiet()).to.be.true

		describe '#isQuiet()', ->

			it 'should return false by default', ->
				expect(log.isQuiet()).to.be.false

	describe 'if quiet is true', ->

		beforeEach ->
			log.setQuiet(true)

		describe '#error()', ->

			it 'should still output to console.error', ->
				testConsoleFunctionBeingCalled('error', 'error', '')

		describe '#warning()', ->

			it 'should still output to console.warn', ->
				testConsoleFunctionBeingCalled('warning', 'warn', '')

		describe '#info()', ->

			it 'should not call console.info', ->
				testConsoleFunctionNotBeingCalled('info', 'info', '')

		describe '#out()', ->

			it 'should not call console.log', ->
				testConsoleFunctionBeingCalled('out', 'log', '')
