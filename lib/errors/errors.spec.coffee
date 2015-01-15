_ = require('lodash')
expect = require('chai').expect
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

	describe '#handleCallback()', ->

		it 'should throw an error if callback is not a function', ->
			expect ->
				errors.handleCallback('hello')
			.to.throw('Callback is not a function')

		it 'should return a new function', ->
			callback = errors.handleCallback(_.noop)
			expect(callback).to.be.an.instanceof(Function)

		describe 'given no error', ->

			it 'should pass arguments back to the callback', ->
				spy = sinon.spy()
				callback = errors.handleCallback(spy)
				callback.call(null, null, 'Hello World', 123)
				expect(spy).to.have.been.calledOnce
				expect(spy).to.have.been.calledWithExactly('Hello World', 123)

			it 'should be able to pass a context', ->
				spy = sinon.spy()
				context =
					foo: 'bar'
				callback = errors.handleCallback(spy, context)
				callback.call(null, null, 'Hello World', 123)
				expect(spy).to.have.been.calledOn(context)

		describe 'given an error', ->

			beforeEach ->
				@handleStub = sinon.stub(errors, 'handle')
				@error = new Error('hello')

			afterEach ->
				@handleStub.restore()

			it 'should call handle() with the error', ->
				callback = errors.handleCallback(_.noop)
				callback.call(null, @error)
				expect(@handleStub).to.have.been.calledOnce
				expect(@handleStub).to.have.been.calledWith(@error)

			it 'should call handle() with the exit boolean parameter', ->
				callback = errors.handleCallback(_.noop, null, false)
				callback.call(null, @error)
				expect(@handleStub).to.have.been.calledOnce
				expect(@handleStub).to.have.been.calledWithExactly(@error, false)
