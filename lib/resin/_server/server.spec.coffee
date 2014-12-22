expect = require('chai').expect
fs = require('fs')
nock = require('nock')
url = require('url')
sinon = require('sinon')
server = require('./server')
settings = require('../settings')
auth = require('../auth/auth')
data = require('../data/data')
mock = require('../../../tests/utils/mock')
johnDoeFixture = require('../../../tests/fixtures/johndoe.json')

METHODS = [
	'GET'
	'HEAD'
	'POST'
	'PUT'
	'DELETE'
	'PATCH'
]

describe 'Server:', ->

	before ->
		mock.connection.init()

	after ->
		mock.connection.restore()

	beforeEach (done) ->
		@uris =
			ok: '/ok'
			nojson: '/nojson'
			error: '/error'

		@responses =
			nojson: 'NO JSON @responses'

		@status =
			ok: 'ok'
			error: 'error'

		testUri = settings.get('remoteUrl')
		nock(testUri).get(@uris.nojson).reply(200, @responses.nojson)
		nock(testUri).get(@uris.error).reply(400, status: @status.error)

		for method in METHODS
			lowercaseMethod = method.toLowerCase()
			nock(testUri)[lowercaseMethod](@uris.ok).reply(200, status: @status.ok)

		mock.fs.init()
		data.prefix.set(settings.get('dataPrefix'), done)

	afterEach ->
		mock.fs.restore()

	describe '#request()', ->

		it 'should make a real HTTP request', (done) ->
			server.request {
				method: 'GET'
				url: @uris.ok
			}, (error, response) =>
				return done(error) if error?
				expect(response.body.status).to.equal(@status.ok)
				expect(response.statusCode).to.equal(200)
				done()

		it 'should make a GET request if method is omitted', (done) ->
			server.request {
				url: @uris.ok
			}, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal('GET')
				done()

		checkRequestType = (type) ->
			return (done) ->
				server.request {
					method: type
					url: @uris.ok
				}, (error, response) ->
					return done(error) if error?
					expect(response.request.method).to.equal(type)
					done()

		for method in METHODS
			it("should make a #{method} request if method is #{method}", checkRequestType(method))

		it 'should get a raw response of response is not JSON', (done) ->
			server.request {
				method: 'GET'
				url: @uris.nojson
			}, (error, response) =>
				return done(error) if error?
				expect(response.body).to.equal(@responses.nojson)
				done()

		it 'should parse the body', (done) ->
			server.request {
				method: 'GET'
				url: @uris.ok
			}, (error, response, body) ->
				expect(error).to.not.exist
				expect(body).to.be.an.object
				expect(body).not.to.be.a.string
				done()

		it 'should be able to send data in the body', (done) ->
			body = { hello: 'world' }

			server.request {
				method: 'POST'
				url: @uris.ok
				json: body
			}, (error, response) ->
				return done(error) if error?
				expect(response.request.body.toString()).to.equal(JSON.stringify(body))
				done()

		it 'should throw an error if method is unknown', (done) ->
			server.request {
				method: 'FOO'
				url: @uris.ok
			}, (error, response) ->
				expect(error).to.exist
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should throw an error if the status code is >= 400', (done) ->
			server.request {
				method: 'GET'
				url: @uris.error
			}, (error, response) ->
				expect(error).to.exist
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should accept a full url', (done) ->
			server.request {
				method: 'GET'
				url: url.resolve(settings.get('remoteUrl'), @uris.ok)
			}, (error, response) =>
				expect(error).to.not.exist
				expect(response.body.status).to.equal(@status.ok)
				done()

		it 'should allow piping files', (done) ->
			onProgressSpy = sinon.spy()
			outputFile = '/hello'

			server.request {
				method: 'GET'
				url: @uris.nojson
				pipe: fs.createWriteStream(outputFile)
			}, (error) =>
				expect(error).to.not.exist
				expect(onProgressSpy).to.have.been.called

				fs.readFile outputFile, { encoding: 'utf8' }, (error, contents) =>
					expect(error).to.not.exist
					expect(contents).to.equal(@responses.nojson)
					done()
			, onProgressSpy

	checkRequestTypeWithoutBody = (type) ->
		return (done) ->
			lowercaseType = type.toLowerCase()
			server[lowercaseType] @uris.ok, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal(type)
				done()

	describe '#get()', ->
		it('should be a facade to request()', checkRequestTypeWithoutBody('GET'))

	describe '#head()', ->
		it('should be a facade to request()', checkRequestTypeWithoutBody('HEAD'))

	describe '#delete()', ->
		it('should be a facade to request()', checkRequestTypeWithoutBody('DELETE'))

	checkRequestTypeWithBody = (type, body) ->
		return (done) ->
			lowercaseType = type.toLowerCase()
			server[lowercaseType] @uris.ok, body, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal(type)
				done()

	describe '#post()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('POST', { hello: 'world' }))

	describe '#put()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('PUT', { hello: 'world' }))

	describe '#patch()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('PATCH', { hello: 'world' }))

	describe 'given there is a token', ->

		beforeEach (done) ->
			nock(settings.get('remoteUrl'))
				.post('/login_', johnDoeFixture.credentials)
				.reply(200, johnDoeFixture.token)

			auth.login(johnDoeFixture.credentials, done)

		describe '#request()', ->

			it 'should send the Authorization header', (done) ->

				server.request {
					method: 'GET'
					url: @uris.ok
				}, (error, response) ->
					authorizationHeader = response?.request.headers.Authorization

					expect(error).to.not.exist
					expect(authorizationHeader).to.exist
					expect(authorizationHeader).to.equal("Bearer #{johnDoeFixture.token}")
					done()

	describe 'given there is not a token', ->

		beforeEach (done) ->
			auth.logout(done)

		describe '#request()', ->

			it 'should not send the Authorization header', (done) ->
				server.request {
					method: 'GET'
					url: @uris.ok
				}, (error, response) ->
					expect(error).to.not.exist
					authorizationHeader = response?.request.headers.Authorization
					expect(authorizationHeader).to.not.exist
					done()

