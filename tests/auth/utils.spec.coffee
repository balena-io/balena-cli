m = require('mochainon')
url = require('url')
Promise = require('bluebird')

tokens = require('./tokens.json')

rewire = require('rewire')
utils = rewire('../../build/auth/utils')
resin = utils.__get__('resin')

describe 'Utils:', ->

	describe '.getDashboardLoginURL()', ->

		it 'should eventually be a valid url', ->
			utils.getDashboardLoginURL('https://127.0.0.1:3000/callback').then (loginUrl) ->
				m.chai.expect ->
					url.parse(loginUrl)
				.to.not.throw(Error)


		it 'should eventually contain an https protocol', ->
			Promise.props
				dashboardUrl: resin.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('https://127.0.0.1:3000/callback')
			.then ({ dashboardUrl, loginUrl }) ->
				protocol = url.parse(loginUrl).protocol
				m.chai.expect(protocol).to.equal(url.parse(dashboardUrl).protocol)

		it 'should correctly escape a callback url without a path', ->
			Promise.props
				dashboardUrl: resin.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000')
			.then ({ dashboardUrl, loginUrl }) ->
				expectedUrl = "#{dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000"
				m.chai.expect(loginUrl).to.equal(expectedUrl)

		it 'should correctly escape a callback url with a path', ->
			Promise.props
				dashboardUrl: resin.settings.get('dashboardUrl')
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000/callback')
			.then ({ dashboardUrl, loginUrl }) ->
				expectedUrl = "#{dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000%252Fcallback"
				m.chai.expect(loginUrl).to.equal(expectedUrl)

	describe '.loginIfTokenValid()', ->

		it 'should eventually be false if token is undefined', ->
			promise = utils.loginIfTokenValid(undefined)
			m.chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is null', ->
			promise = utils.loginIfTokenValid(null)
			m.chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is an empty string', ->
			promise = utils.loginIfTokenValid('')
			m.chai.expect(promise).to.eventually.be.false

		it 'should eventually be false if token is a string containing only spaces', ->
			promise = utils.loginIfTokenValid('     ')
			m.chai.expect(promise).to.eventually.be.false

		describe 'given the token does not authenticate with the server', ->

			beforeEach ->
				@resinAuthIsLoggedInStub = m.sinon.stub(resin.auth, 'isLoggedIn')
				@resinAuthIsLoggedInStub.returns(Promise.resolve(false))

			afterEach ->
				@resinAuthIsLoggedInStub.restore()

			it 'should eventually be false', ->
				promise = utils.loginIfTokenValid(tokens.johndoe.token)
				m.chai.expect(promise).to.eventually.be.false

			describe 'given there was a token already', ->

				beforeEach ->
					resin.auth.loginWithToken(tokens.janedoe.token)

				it 'should preserve the old token', ->
					resin.auth.getToken().then (originalToken) ->
						m.chai.expect(originalToken).to.equal(tokens.janedoe.token)
						return utils.loginIfTokenValid(tokens.johndoe.token)
					.then(resin.auth.getToken).then (currentToken) ->
						m.chai.expect(currentToken).to.equal(tokens.janedoe.token)

			describe 'given there was no token', ->

				beforeEach ->
					resin.auth.logout()

				it 'should stay without a token', ->
					utils.loginIfTokenValid(tokens.johndoe.token).then ->
						resin.auth.isLoggedIn()
					.then (isLoggedIn) ->
						m.chai.expect(isLoggedIn).to.equal(false)

		describe 'given the token does authenticate with the server', ->

			beforeEach ->
				@resinAuthIsLoggedInStub = m.sinon.stub(resin.auth, 'isLoggedIn')
				@resinAuthIsLoggedInStub.returns(Promise.resolve(true))

			afterEach ->
				@resinAuthIsLoggedInStub.restore()

			it 'should eventually be true', ->
				promise = utils.loginIfTokenValid(tokens.johndoe.token)
				m.chai.expect(promise).to.eventually.be.true
