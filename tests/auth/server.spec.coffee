chai = require('chai')
chaiAsPromised = require('chai-as-promised')
request = require('request')
sinon = require('sinon')
Promise = require('bluebird')
path = require('path')
fs = require('fs')
ejs = require('ejs')
server = require('../../build/auth/server')
utils = require('../../build/auth/utils')
tokens = require('./tokens.json')

chai.use(chaiAsPromised)

options =
	port: 3000
	path: '/auth'

getPage = (name) ->
	pagePath = path.join(__dirname, '..', '..', 'build', 'auth', 'pages', "#{name}.ejs")
	tpl = fs.readFileSync(pagePath, encoding: 'utf8')
	compiledTpl = ejs.compile(tpl)
	return server.getContext(name)
		.then (context) ->
			compiledTpl(context)

describe 'Server:', ->

	it 'should get 404 if posting to an unknown path', (done) ->
		promise = server.awaitForToken(options)
		chai.expect(promise).to.be.rejectedWith('Unknown path or verb')

		request.post "http://localhost:#{options.port}/foobarbaz",
			form:
				token: tokens.johndoe.token
		, (error, response, body) ->
			chai.expect(error).to.not.exist
			chai.expect(response.statusCode).to.equal(404)
			chai.expect(body).to.equal('Not found')
			done()

	it 'should get 404 if not using the correct verb', (done) ->
		promise = server.awaitForToken(options)
		chai.expect(promise).to.be.rejectedWith('Unknown path or verb')

		request.get "http://localhost:#{options.port}#{options.path}",
			form:
				token: tokens.johndoe.token
		, (error, response, body) ->
			chai.expect(error).to.not.exist
			chai.expect(response.statusCode).to.equal(404)
			chai.expect(body).to.equal('Not found')
			done()

	describe 'given the token authenticates with the server', ->

		beforeEach ->
			@loginIfTokenValidStub = sinon.stub(utils, 'loginIfTokenValid')
			@loginIfTokenValidStub.returns(Promise.resolve(true))

		afterEach ->
			@loginIfTokenValidStub.restore()

		it 'should eventually be the token', (done) ->
			promise = server.awaitForToken(options)
			chai.expect(promise).to.eventually.equal(tokens.johndoe.token)

			request.post "http://localhost:#{options.port}#{options.path}",
				form:
					token: tokens.johndoe.token
			, (error, response, body) ->
				chai.expect(error).to.not.exist
				chai.expect(response.statusCode).to.equal(200)
				getPage('success').then (expectedBody) ->
					chai.expect(body).to.equal(expectedBody)
					done()

	describe 'given the token does not authenticate with the server', ->

		beforeEach ->
			@loginIfTokenValidStub = sinon.stub(utils, 'loginIfTokenValid')
			@loginIfTokenValidStub.returns(Promise.resolve(false))

		afterEach ->
			@loginIfTokenValidStub.restore()

		it 'should be rejected', (done) ->
			promise = server.awaitForToken(options)
			chai.expect(promise).to.be.rejectedWith('Invalid token')

			request.post "http://localhost:#{options.port}#{options.path}",
				form:
					token: tokens.johndoe.token
			, (error, response, body) ->
				chai.expect(error).to.not.exist
				chai.expect(response.statusCode).to.equal(401)
				getPage('error').then (expectedBody) ->
					chai.expect(body).to.equal(expectedBody)
					done()

		it 'should be rejected if no token', (done) ->
			promise = server.awaitForToken(options)
			chai.expect(promise).to.be.rejectedWith('No token')

			request.post "http://localhost:#{options.port}#{options.path}",
				form:
					token: ''
			, (error, response, body) ->
				chai.expect(error).to.not.exist
				chai.expect(response.statusCode).to.equal(401)
				getPage('error').then (expectedBody) ->
					chai.expect(body).to.equal(expectedBody)
					done()

		it 'should be rejected if token is malformed', (done) ->
			promise = server.awaitForToken(options)
			chai.expect(promise).to.be.rejectedWith('Invalid token')

			request.post "http://localhost:#{options.port}#{options.path}",
				form:
					token: 'asdf'
			, (error, response, body) ->
				chai.expect(error).to.not.exist
				chai.expect(response.statusCode).to.equal(401)
				getPage('error').then (expectedBody) ->
					chai.expect(body).to.equal(expectedBody)
					done()

