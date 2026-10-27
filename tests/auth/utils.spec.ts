import { expect } from 'chai';
import * as sinon from 'sinon';
import { getBalenaSdk } from '../../build/utils/lazy';
import * as utils from '../../build/auth/utils';
import tokens from './tokens';

const balena = getBalenaSdk();

describe('Utils:', function () {
	describe('.getDashboardLoginURL()', function () {
		it('should eventually be a valid url', async () => {
			const loginUrl = await utils.getDashboardLoginURL(
				'https://127.0.0.1:3000/callback',
			);
			expect(() => new URL(loginUrl)).to.not.throw(Error);
		});

		it('should eventually contain an https protocol', async () => {
			const [dashboardUrl, loginUrl] = await Promise.all([
				balena.settings.get('dashboardUrl'),
				utils.getDashboardLoginURL('https://127.0.0.1:3000/callback'),
			]);
			const dashboardURL = new URL(dashboardUrl);
			const loginURL = new URL(loginUrl);
			expect(loginURL.protocol).to.equal(dashboardURL.protocol);
		});

		it('should correctly escape a callback url without a path', () =>
			Promise.all([
				balena.settings.get('dashboardUrl'),
				utils.getDashboardLoginURL('http://127.0.0.1:3000'),
			]).then(function ([dashboardUrl, loginUrl]) {
				const expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000`;
				expect(loginUrl).to.equal(expectedUrl);
			}));

		it('should correctly escape a callback url with a path', () =>
			Promise.all([
				balena.settings.get('dashboardUrl'),
				utils.getDashboardLoginURL('http://127.0.0.1:3000/callback'),
			]).then(function ([dashboardUrl, loginUrl]) {
				const expectedUrl = `${dashboardUrl}/login/cli/http%253A%252F%252F127.0.0.1%253A3000%252Fcallback`;
				expect(loginUrl).to.equal(expectedUrl);
			}));
	});

	describe('.loginIfTokenValid()', function () {
		it('should eventually be false if token is undefined', async function () {
			const loginTokenValid = await utils.loginIfTokenValid(undefined);
			expect(loginTokenValid).to.be.false;
		});

		it('should eventually be false if token is undefined', async function () {
			const loginTokenValid = await utils.loginIfTokenValid(undefined);
			expect(loginTokenValid).to.be.false;
		});

		it('should eventually be false if token is an empty string', async function () {
			const loginTokenValid = await utils.loginIfTokenValid('');
			expect(loginTokenValid).to.be.false;
		});

		it('should eventually be false if token is a string containing only spaces', async function () {
			const loginTokenValid = await utils.loginIfTokenValid('     ');
			expect(loginTokenValid).to.be.false;
		});

		describe('given the token does not authenticate with the server', function () {
			beforeEach(function () {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.resolves(false);
			});

			afterEach(function () {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			it('should eventually be false', async function () {
				const loginTokenValid = await utils.loginIfTokenValid(
					tokens.johndoe.token,
				);
				expect(loginTokenValid).to.be.false;
			});

			describe('given there was a token already', function () {
				beforeEach(() => balena.auth.loginWithToken(tokens.janedoe.token));

				it('should preserve the old token', () =>
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

			describe('given there was no token', function () {
				beforeEach(() => balena.auth.logout());

				it('should stay without a token', () =>
					utils
						.loginIfTokenValid(tokens.johndoe.token)
						.then(() => balena.auth.isLoggedIn())
						.then((isLoggedIn: boolean) => expect(isLoggedIn).to.equal(false)));
			});
		});

		describe('given the token does authenticate with the server', function () {
			beforeEach(function () {
				this.balenaAuthIsLoggedInStub = sinon.stub(balena.auth, 'isLoggedIn');
				return this.balenaAuthIsLoggedInStub.resolves(true);
			});

			afterEach(function () {
				return this.balenaAuthIsLoggedInStub.restore();
			});

			it('should eventually be true', async function () {
				const loginTokenValid = await utils.loginIfTokenValid(
					tokens.johndoe.token,
				);
				expect(loginTokenValid).to.be.true;
			});
		});
	});
});
