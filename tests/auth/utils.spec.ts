import Bluebird from 'bluebird';
import { expect } from 'chai';
import rewire = require('rewire');
import * as sinon from 'sinon';
import * as url from 'url';
import { getBalenaSdk } from '../../build/utils/lazy';
import tokens from './tokens';

const utils = rewire('../../build/auth/utils');
const balena = getBalenaSdk();

describe('Utils:', function () {
	describe('.getDashboardLoginURL()', function () {
		it('should eventually be a valid url', () =>
			utils
				.getDashboardLoginURL('https://127.0.0.1:3000/callback')
				.then((loginUrl: string) =>
					expect(() => url.parse(loginUrl)).to.not.throw(Error),
				));

		it('should eventually contain an https protocol', () =>
			Bluebird.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('https://127.0.0.1:3000/callback'),
			}).then(function ({ dashboardUrl, loginUrl }) {
				const { protocol } = url.parse(loginUrl);
				return expect(protocol).to.equal(url.parse(dashboardUrl).protocol);
			}));

		it('should correctly escape a callback url without a path', () =>
			Bluebird.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000'),
			}).then(function ({ dashboardUrl, loginUrl }) {
				const expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000`;
				return expect(loginUrl).to.equal(expectedUrl);
			}));

		return it('should correctly escape a callback url with a path', () =>
			Bluebird.props({
				dashboardUrl: balena.settings.get('dashboardUrl'),
				loginUrl: utils.getDashboardLoginURL('http://127.0.0.1:3000/callback'),
			}).then(function ({ dashboardUrl, loginUrl }) {
				const expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000%252Fcallback`;
				return expect(loginUrl).to.equal(expectedUrl);
			}));
	});

	return describe('.loginIfTokenValid()', function () {
		it('should eventually be false if token is undefined', function () {
			const promise = utils.loginIfTokenValid(undefined);
			return expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is null', function () {
			const promise = utils.loginIfTokenValid(null);
			return expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is an empty string', function () {
			const promise = utils.loginIfTokenValid('');
			return expect(promise).to.eventually.be.false;
		});

		it('should eventually be false if token is a string containing only spaces', function () {
			const promise = utils.loginIfTokenValid('     ');
			return expect(promise).to.eventually.be.false;
		});

		describe('given the token does not authenticate with the server', function () {
			beforeEach(function () {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.resolves(false);
			});

			afterEach(function () {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			it('should eventually be false', function () {
				const promise = utils.loginIfTokenValid(tokens.johndoe.token);
				return expect(promise).to.eventually.be.false;
			});

			describe('given there was a token already', function () {
				beforeEach(() => balena.auth.loginWithToken(tokens.janedoe.token));

				return it('should preserve the old token', () =>
					balena.auth
						.getToken()
						.then(function (originalToken: string) {
							expect(originalToken).to.equal(tokens.janedoe.token);
							return utils.loginIfTokenValid(tokens.johndoe.token);
						})
						.then(balena.auth.getToken)
						.then((currentToken: string) =>
							expect(currentToken).to.equal(tokens.janedoe.token),
						));
			});

			return describe('given there was no token', function () {
				beforeEach(() => balena.auth.logout());

				return it('should stay without a token', () =>
					utils
						.loginIfTokenValid(tokens.johndoe.token)
						.then(() => balena.auth.isLoggedIn())
						.then((isLoggedIn: boolean) => expect(isLoggedIn).to.equal(false)));
			});
		});

		return describe('given the token does authenticate with the server', function () {
			beforeEach(function () {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.resolves(true);
			});

			afterEach(function () {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			return it('should eventually be true', function () {
				const promise = utils.loginIfTokenValid(tokens.johndoe.token);
				return expect(promise).to.eventually.be.true;
			});
		});
	});
});
