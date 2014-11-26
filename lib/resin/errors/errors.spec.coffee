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

		checkProcessExitOption = (error, value, expectations) ->
			processExitStub = sinon.stub(process, 'exit')
			logErrorStub = sinon.stub(log, 'error')
			errors.handle(error, value)
			expectations(processExitStub)
			processExitStub.restore()
			logErrorStub.restore()

		it 'should exit if the last parameter is true', ->
			error = new Error(MESSAGES.helloWorld)
			checkProcessExitOption error, true, (processExitStub) ->
				expect(processExitStub).to.have.been.calledWith(1)

		it 'should not exit if the last parameter is false', ->
			error = new Error(MESSAGES.helloWorld)
			checkProcessExitOption error, false, (processExitStub) ->
				expect(processExitStub).to.not.have.been.called

		it 'should handle a custom error code from the error instance', ->
			error = new Error()
			error.code = 123
			checkProcessExitOption error, true, (processExitStub) ->
				expect(processExitStub).to.have.been.calledWith(123)

	describe 'NotFound', ->

		it 'should get a custom message', ->
			message = 'Foo'
			error = new errors.NotFound(message)
			expect(error.message).to.not.equal(message)
			expect(error.message).to.contain(message)
