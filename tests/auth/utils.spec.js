const chai = require('chai');
const sinon = require('sinon');
const url = require('url');
const Promise = require('bluebird');

const tokens = require('./tokens.json');

const rewire = require('rewire');
let utils = rewire('../../build/auth/utils');
let balena = utils.__get__('balena');

describe('Utils:', function() {

	describe('.getDashboardLoginURL()', function() {

		it('should eventually be a valid url', () =>
			utils.getDashboardLoginURL('https://127.0.0.1:3000/callback').then(loginUrl =>
				chai.expect(() => url.parse(loginUrl)).to.not.throw(Error)
			)
		);


		it('should eventually contain an https protocol', () =>
			Promise.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('https://127.0.0.1:3000/callback')}).then(function({ dashboardUrl, loginUrl }) {
				let { protocol } = url.parse(loginUrl);
				return chai.expect(protocol).to.equal(url.parse(dashboardUrl).protocol);
			})
		);

		it('should correctly escape a callback url without a path', () =>
			Promise.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000')}).then(function({ dashboardUrl, loginUrl }) {
				let expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000`;
				return chai.expect(loginUrl).to.equal(expectedUrl);
			})
		);

		return it('should correctly escape a callback url with a path', () =>
			Promise.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000/callback')}).then(function({ dashboardUrl, loginUrl }) {
				let expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000%252Fcallback`;
				return chai.expect(loginUrl).to.equal(expectedUrl);
			})
		);
	});

	return describe('.loginIfTokenValid()', function() {

		it('should eventually be false if token is undefined', function() {
			let promise = utils.loginIfTokenValid(undefined);
			return chai.expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is null', function() {
			let promise = utils.loginIfTokenValid(null);
			return chai.expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is an empty string', function() {
			let promise = utils.loginIfTokenValid('');
			return chai.expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is a string containing only spaces', function() {
			let promise = utils.loginIfTokenValid('     ');
			return chai.expect(promise).to.eventually.be.false;
		});

		describe('given the token does not authenticate with the server', function() {

			beforeEach(function() {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.returns(Promise.resolve(false));
			});

			afterEach(function() {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			it('should eventually be false', function() {
				let promise = utils.loginIfTokenValid(tokens.johndoe.token);
				return chai.expect(promise).to.eventually.be.false;
			});

			describe('given there was a token already', function() {

				beforeEach(() => balena.auth.loginWithToken(tokens.janedoe.token));

				return it('should preserve the old token', () =>
					balena.auth.getToken().then(function(originalToken) {
						chai.expect(originalToken).to.equal(tokens.janedoe.token);
						return utils.loginIfTokenValid(tokens.johndoe.token);}).then(balena.auth.getToken).then(currentToken => chai.expect(currentToken).to.equal(tokens.janedoe.token))
				);
			});

			return describe('given there was no token', function() {

				beforeEach(() => balena.auth.logout());

				return it('should stay without a token', () =>
					utils.loginIfTokenValid(tokens.johndoe.token).then(() => balena.auth.isLoggedIn()).then(isLoggedIn => chai.expect(isLoggedIn).to.equal(false))
				);
			});
		});

		return describe('given the token does authenticate with the server', function() {

			beforeEach(function() {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.returns(Promise.resolve(true));
			});

			afterEach(function() {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			return it('should eventually be true', function() {
				let promise = utils.loginIfTokenValid(tokens.johndoe.token);
				return chai.expect(promise).to.eventually.be.true;
			});
		});
	});
});
