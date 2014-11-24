expect = require('chai').expect
sinon = require('sinon')
log = require('../log/log')
errors = require('./errors')

MESSAGES =
	helloWorld: 'Hello World'

describe 'Errors:', ->

	describe '#handle()', ->

		it 'should log the error message to stderr', ->
			logErrorStub = sinon.stub(log, 'error')
			error = new Error(MESSAGES.helloWorld)
			errors.handle(error, false)
			expect(logErrorStub).to.have.been.calledWith(MESSAGES.helloWorld)
			logErrorStub.restore()

		it 'should do nothing if error is not an instance of Error', ->
			logErrorStub = sinon.stub(log, 'error')

			for item in [
				undefined
				null
				[ 1, 2, 3 ]
				'Hello'
				{ message: 'foo bar' }
			]
				errors.handle(item, false)

			expect(logErrorStub).to.not.have.been.called
			logErrorStub.restore()

		checkProcessExitOption = (value, expectations) ->
			processExitStub = sinon.stub(process, 'exit')
			logErrorStub = sinon.stub(log, 'error')
			errors.handle(new Error(MESSAGES.helloWorld), value)
			expectations(processExitStub)
			processExitStub.restore()
			logErrorStub.restore()

		it 'should exit if the last parameter is true', ->
			checkProcessExitOption true, (processExitStub) ->
				expect(processExitStub).to.have.been.called

		it 'should not exit if the last parameter is false', ->
			checkProcessExitOption false, (processExitStub) ->
				expect(processExitStub).to.not.have.been.called

	describe 'NotFound', ->

		it 'should get a custom message', ->
			message = 'Foo'
			error = new errors.NotFound(message)
			expect(error.message).to.not.equal(message)
			expect(error.message).to.contain(message)
