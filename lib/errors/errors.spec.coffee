chai = require('chai')
expect = chai.expect
chai.use(require('sinon-chai'))
_ = require('lodash')
sinon = require('sinon')
errors = require('./errors')

describe 'Errors:', ->

	describe '#handle()', ->

		it 'should log the error message to stderr', ->
			message = 'Hello World'
			logErrorStub = sinon.stub(console, 'error')
			error = new Error(message)
			errors.handle(error, false)
			expect(logErrorStub).to.have.been.calledWith(message)
			logErrorStub.restore()

		it 'should do nothing if error is not an instance of Error', ->
			logErrorStub = sinon.stub(console, 'error')

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
			logErrorStub = sinon.stub(console, 'error')
			errors.handle(error, value)
			expectations(processExitStub, logErrorStub)
			processExitStub.restore()
			logErrorStub.restore()

		it 'should exit if the last parameter is true', ->
			error = new Error()
			checkProcessExitOption error, true, (processExitStub) ->
				expect(processExitStub).to.have.been.calledWith(1)

		it 'should not exit if the last parameter is false', ->
			error = new Error()
			checkProcessExitOption error, false, (processExitStub) ->
				expect(processExitStub).to.not.have.been.called

		it 'should handle a custom error exit code from the error instance', ->
			error = new Error()
			error.exitCode = 123
			checkProcessExitOption error, true, (processExitStub) ->
				expect(processExitStub).to.have.been.calledWith(123)

		it 'should print stack trace if DEBUG is set', ->
			process.env.DEBUG = true
			error = new Error()
			checkProcessExitOption error, false, (processExitStub, logErrorStub) ->
				expect(logErrorStub).to.have.been.calledOnce
				expect(logErrorStub).to.have.been.calledWith(error.stack)
				delete process.env.DEBUG

		it 'should handle EISDIR', ->
			error = new Error()
			error.code = 'EISDIR'
			error.path = 'hello'
			checkProcessExitOption error, false, (processExitStub, logErrorStub) ->
				expect(logErrorStub).to.have.been.calledOnce
				expect(logErrorStub).to.have.been.calledWith('File is a directory: hello')

		it 'should handle ENOENT', ->
			error = new Error()
			error.code = 'ENOENT'
			error.path = 'hello'
			checkProcessExitOption error, false, (processExitStub, logErrorStub) ->
				expect(logErrorStub).to.have.been.calledOnce
				expect(logErrorStub).to.have.been.calledWith('No such file or directory: hello')

		it 'should handle EACCES', ->
			error = new Error()
			error.code = 'EACCES'
			checkProcessExitOption error, false, (processExitStub, logErrorStub) ->
				expect(logErrorStub).to.have.been.calledOnce
				expect(logErrorStub.getCall(0).args[0]).to.match(/^You don\'t have enough privileges to run this operation./)
