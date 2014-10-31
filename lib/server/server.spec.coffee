expect = require('chai').expect
nock = require('nock')
server = require('./server')
config = require('../config')

TEST_URI = config.baseUrl

URI =
	ok: '/ok'
	nojson: '/nojson'

RESPONSE =
	nojson: 'NO JSON RESPONSE'

STATUS =
	ok: 'ok'

METHODS = [
	'GET'
	'HEAD'
	'POST'
	'PUT'
	'DELETE'
	'PATCH'
]

describe 'Server', ->

	beforeEach ->
		nock(TEST_URI).get('/nojson').reply(200, RESPONSE.nojson)

		for method in METHODS
			lowercaseMethod = method.toLowerCase()
			nock(TEST_URI)[lowercaseMethod]('/ok').reply(200, status: STATUS.ok)

	describe '#request()', ->

		it 'should make a real HTTP request', (done) ->
			server.request 'GET', URI.ok, null, (error, response) ->
				return done(error) if error?
				expect(response.body.status).to.equal(STATUS.ok)
				expect(response.statusCode).to.equal(200)
				done()

		it 'should make a GET request if method is omitted', (done) ->
			server.request undefined, URI.ok, null, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal('GET')
				done()

		checkRequestType = (type) ->
			return (done) ->
				server.request type, URI.ok, null, (error, response) ->
					return done(error) if error?
					expect(response.request.method).to.equal(type)
					done()

		for method in METHODS
			it("should make a #{method} request if method is #{method}", checkRequestType(method))

		it 'should get a raw response of response is not JSON', (done) ->
			server.request 'GET', URI.nojson, null, (error, response) ->
				return done(error) if error?
				expect(response.body).to.equal(RESPONSE.nojson)
				done()

		it 'should be able to send data in the body', (done) ->
			body = { hello: 'world' }

			server.request 'POST', URI.ok, body, (error, response) ->
				return done(error) if error?
				expect(response.request.body.toString()).to.equal(JSON.stringify(body))
				done()

		it 'should throw an error if method is unknown', (done) ->
			server.request 'FOO', URI.ok, null, (error, response) ->
				expect(error).to.exist
				expect(error).to.be.an.instanceof(Error)
				done()

	checkRequestTypeWithoutBody = (type) ->
		return (done) ->
			lowercaseType = type.toLowerCase()
			server[lowercaseType] URI.ok, (error, response) ->
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
			server[lowercaseType] URI.ok, body, (error, response) ->
				return done(error) if error?
				expect(response.request.method).to.equal(type)
				done()

	describe '#post()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('POST', { hello: 'world' }))

	describe '#put()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('PUT', { hello: 'world' }))

	describe '#patch()', ->
		it('should be a facade to request()', checkRequestTypeWithBody('PATCH', { hello: 'world' }))
