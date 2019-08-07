chai = require('chai')
sinon = require('sinon')
url = require('url')
Promise = require('bluebird')

tokens = require('./tokens.json')

rewire = require('rewire')
utils = rewire('../../build/auth/utils')
balena = utils.__get__('balena')

describe 'Utils:', ->

	describe '.getDashboardLoginURL()', ->

		it 'should eventually be a valid url', ->
			utils.getDashboardLoginURL('https://127.0.0.1:3000/callback').then (loginUrl) ->
				chai.expect ->
					url.parse(loginUrl)
				.to.not.throw(Error)


		it 'should eventually contain an https protocol', ->
			Promise.props
				dashboardUrl: balena.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('https://127.0.0.1:3000/callback')
			.then ({ dashboardUrl, loginUrl }) ->
				protocol = url.parse(loginUrl).protocol
				chai.expect(protocol).to.equal(url.parse(dashboardUrl).protocol)

		it 'should correctly escape a callback url without a path', ->
			Promise.props
				dashboardUrl: balena.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000')
			.then ({ dashboardUrl, loginUrl }) ->
				expectedUrl = "#{dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000"
				chai.expect(loginUrl).to.equal(expectedUrl)

		it 'should correctly escape a callback url with a path', ->
			Promise.props
				dashboardUrl: balena.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000/callback')
			.then ({ dashboardUrl, loginUrl }) ->
				expectedUrl = "#{dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000%252Fcallback"
				chai.expect(loginUrl).to.equal(expectedUrl)

	describe '.loginIfTokenValid()', ->

		it 'should eventually be false if token is undefined', ->
			promise = utils.loginIfTokenValid(undefined)
			chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is null', ->
			promise = utils.loginIfTokenValid(null)
			chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is an empty string', ->
			promise = utils.loginIfTokenValid('')
			chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is a string containing only spaces', ->
			promise = utils.loginIfTokenValid('     ')
			chai.expect(promise).to.eventually.be.false

		describe 'given the token does not authenticate with the server', ->

			beforeEach ->
				@balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn')
				@balenaAuthIsLoggedInStub.returns(Promise.resolve(false))

			afterEach ->
				@balenaAuthIsLoggedInStub.restore()

			it 'should eventually be false', ->
				promise = utils.loginIfTokenValid(tokens.johndoe.token)
				chai.expect(promise).to.eventually.be.false

			describe 'given there was a token already', ->

				beforeEach ->
					balena.auth.loginWithToken(tokens.janedoe.token)

				it 'should preserve the old token', ->
					balena.auth.getToken().then (originalToken) ->
						chai.expect(originalToken).to.equal(tokens.janedoe.token)
						return utils.loginIfTokenValid(tokens.johndoe.token)
					.then(balena.auth.getToken).then (currentToken) ->
						chai.expect(currentToken).to.equal(tokens.janedoe.token)

			describe 'given there was no token', ->

				beforeEach ->
					balena.auth.logout()

				it 'should stay without a token', ->
					utils.loginIfTokenValid(tokens.johndoe.token).then ->
						balena.auth.isLoggedIn()
					.then (isLoggedIn) ->
						chai.expect(isLoggedIn).to.equal(false)

		describe 'given the token does authenticate with the server', ->

			beforeEach ->
				@balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn')
				@balenaAuthIsLoggedInStub.returns(Promise.resolve(true))

			afterEach ->
				@balenaAuthIsLoggedInStub.restore()

			it 'should eventually be true', ->
				promise = utils.loginIfTokenValid(tokens.johndoe.token)
				chai.expect(promise).to.eventually.be.true
