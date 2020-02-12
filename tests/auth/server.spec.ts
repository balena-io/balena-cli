import * as Promise from 'bluebird';
import * as chai from 'chai';
import chaiAsPromised = require('chai-as-promised');
import * as ejs from 'ejs';
import * as fs from 'fs';
import * as path from 'path';
import * as request from 'request';
import * as sinon from 'sinon';

// TODO: Convert server code to Typescript so it can have a declaration file
// @ts-ignore
import * as server from '../../build/auth/server';

// TODO: Convert utils code to Typescript so it can have a declaration file
// @ts-ignore
import * as utils from '../../build/auth/utils';
import tokens from './tokens';

chai.use(chaiAsPromised);

const { expect } = chai;

const options = {
	port: 3000,
	path: '/auth',
};

const getPage = function(
	name: Parameters<typeof server.getContext>[0],
): Promise<string> {
	const pagePath = path.join(
		__dirname,
		'..',
		'..',
		'build',
		'auth',
		'pages',
		`${name}.ejs`,
	);
	const tpl = fs.readFileSync(pagePath, { encoding: 'utf8' });
	const compiledTpl = ejs.compile(tpl);
	return server.getContext(name).then((context: any) => compiledTpl(context));
};

describe('Server:', function() {
	it('should get 404 if posting to an unknown path', function(done) {
		const promise = server.awaitForToken(options);
		expect(promise).to.be.rejectedWith('Unknown path or verb');

		return request.post(
			`http://localhost:${options.port}/foobarbaz`,
			{
				form: {
					token: tokens.johndoe.token,
				},
			},
			function(error, response, body) {
				expect(error).to.not.exist;
				expect(response.statusCode).to.equal(404);
				expect(body).to.equal('Not found');
				return done();
			},
		);
	});

	it('should get 404 if not using the correct verb', function(done) {
		const promise = server.awaitForToken(options);
		expect(promise).to.be.rejectedWith('Unknown path or verb');

		return request.get(
			`http://localhost:${options.port}${options.path}`,
			{
				form: {
					token: tokens.johndoe.token,
				},
			},
			function(error, response, body) {
				expect(error).to.not.exist;
				expect(response.statusCode).to.equal(404);
				expect(body).to.equal('Not found');
				return done();
			},
		);
	});

	describe('given the token authenticates with the server', function() {
		beforeEach(function() {
			this.loginIfTokenValidStub = sinon.stub(utils, 'loginIfTokenValid');
			return this.loginIfTokenValidStub.returns(Promise.resolve(true));
		});

		afterEach(function() {
			return this.loginIfTokenValidStub.restore();
		});

		return it('should eventually be the token', function(done) {
			const promise = server.awaitForToken(options);
			expect(promise).to.eventually.equal(tokens.johndoe.token);

			return request.post(
				`http://localhost:${options.port}${options.path}`,
				{
					form: {
						token: tokens.johndoe.token,
					},
				},
				function(error, response, body) {
					expect(error).to.not.exist;
					expect(response.statusCode).to.equal(200);
					return getPage('success').then(function(expectedBody) {
						expect(body).to.equal(expectedBody);
						return done();
					});
				},
			);
		});
	});

	return describe('given the token does not authenticate with the server', function() {
		beforeEach(function() {
			this.loginIfTokenValidStub = sinon.stub(utils, 'loginIfTokenValid');
			return this.loginIfTokenValidStub.returns(Promise.resolve(false));
		});

		afterEach(function() {
			return this.loginIfTokenValidStub.restore();
		});

		it('should be rejected', function(done) {
			const promise = server.awaitForToken(options);
			expect(promise).to.be.rejectedWith('Invalid token');

			return request.post(
				`http://localhost:${options.port}${options.path}`,
				{
					form: {
						token: tokens.johndoe.token,
					},
				},
				function(error, response, body) {
					expect(error).to.not.exist;
					expect(response.statusCode).to.equal(401);
					return getPage('error').then(function(expectedBody) {
						expect(body).to.equal(expectedBody);
						return done();
					});
				},
			);
		});

		it('should be rejected if no token', function(done) {
			const promise = server.awaitForToken(options);
			expect(promise).to.be.rejectedWith('No token');

			return request.post(
				`http://localhost:${options.port}${options.path}`,
				{
					form: {
						token: '',
					},
				},
				function(error, response, body) {
					expect(error).to.not.exist;
					expect(response.statusCode).to.equal(401);
					return getPage('error').then(function(expectedBody) {
						expect(body).to.equal(expectedBody);
						return done();
					});
				},
			);
		});

		return it('should be rejected if token is malformed', function(done) {
			const promise = server.awaitForToken(options);
			expect(promise).to.be.rejectedWith('Invalid token');

			return request.post(
				`http://localhost:${options.port}${options.path}`,
				{
					form: {
						token: 'asdf',
					},
				},
				function(error, response, body) {
					expect(error).to.not.exist;
					expect(response.statusCode).to.equal(401);
					return getPage('error').then(function(expectedBody) {
						expect(body).to.equal(expectedBody);
						return done();
					});
				},
			);
		});
	});
});
