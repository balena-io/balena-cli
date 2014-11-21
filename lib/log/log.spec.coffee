_ = require('lodash')
chai = require('chai')
chai.use(require('sinon-chai'))
expect = chai.expect
sinon = require('sinon')
log = require('./log')

MESSAGE =
	foobar: 'Foo Bar'

	# Very handy to check that the real console functions
	# were called without printing anything, and preventing
	# us from having to mock console, which is used by Mocha
	empty: ''

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
				testConsoleFunctionBeingCalled('error', 'error', MESSAGE.empty)

		describe '#warning()', ->

			it 'should output to console.warn', ->
				testConsoleFunctionBeingCalled('warning', 'warn', MESSAGE.empty)

		describe '#info()', ->

			it 'should output to console.info', ->
				testConsoleFunctionBeingCalled('info', 'info', MESSAGE.empty)

		describe '#out()', ->

			it 'should output to console.log', ->
				testConsoleFunctionBeingCalled('out', 'log', MESSAGE.empty)

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
				testConsoleFunctionBeingCalled('error', 'error', MESSAGE.empty)

		describe '#warning()', ->

			it 'should still output to console.warn', ->
				testConsoleFunctionBeingCalled('warning', 'warn', MESSAGE.empty)

		describe '#info()', ->

			it 'should not call console.info', ->
				testConsoleFunctionNotBeingCalled('info', 'info', MESSAGE.empty)

		describe '#out()', ->

			it 'should not call console.log', ->
				testConsoleFunctionBeingCalled('out', 'log', MESSAGE.empty)
