const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const request = require('request');
const sinon = require('sinon');
const Promise = require('bluebird');
const path = require('path');
const fs = require('fs');
const ejs = require('ejs');
const server = require('../../build/auth/server');
const utils = require('../../build/auth/utils');
const tokens = require('./tokens.json');

chai.use(chaiAsPromised);

let options = {
	port: 3000,
	path: '/auth'
};

let getPage = function(name) {
	let pagePath = path.join(__dirname, '..', '..', 'build', 'auth', 'pages', `${name}.ejs`);
	let tpl = fs.readFileSync(pagePath, {encoding: 'utf8'});
	let compiledTpl = ejs.compile(tpl);
	return server.getContext(name)
		.then(context => compiledTpl(context));
};

describe('Server:', function() {

	it('should get 404 if posting to an unknown path', function(done) {
		let promise = server.awaitForToken(options);
		chai.expect(promise).to.be.rejectedWith('Unknown path or verb');

		return request.post(`http://localhost:${options.port}/foobarbaz`, {
			form: {
				token: tokens.johndoe.token
			}
		}
		, function(error, response, body) {
			chai.expect(error).to.not.exist;
			chai.expect(response.statusCode).to.equal(404);
			chai.expect(body).to.equal('Not found');
			return done();
		});
	});

	it('should get 404 if not using the correct verb', function(done) {
		let promise = server.awaitForToken(options);
		chai.expect(promise).to.be.rejectedWith('Unknown path or verb');

		return request.get(`http://localhost:${options.port}${options.path}`, {
			form: {
				token: tokens.johndoe.token
			}
		}
		, function(error, response, body) {
			chai.expect(error).to.not.exist;
			chai.expect(response.statusCode).to.equal(404);
			chai.expect(body).to.equal('Not found');
			return done();
		});
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
			let promise = server.awaitForToken(options);
			chai.expect(promise).to.eventually.equal(tokens.johndoe.token);

			return request.post(`http://localhost:${options.port}${options.path}`, {
				form: {
					token: tokens.johndoe.token
				}
			}
			, function(error, response, body) {
				chai.expect(error).to.not.exist;
				chai.expect(response.statusCode).to.equal(200);
				return getPage('success').then(function(expectedBody) {
					chai.expect(body).to.equal(expectedBody);
					return done();
				});
			});
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
			let promise = server.awaitForToken(options);
			chai.expect(promise).to.be.rejectedWith('Invalid token');

			return request.post(`http://localhost:${options.port}${options.path}`, {
				form: {
					token: tokens.johndoe.token
				}
			}
			, function(error, response, body) {
				chai.expect(error).to.not.exist;
				chai.expect(response.statusCode).to.equal(401);
				return getPage('error').then(function(expectedBody) {
					chai.expect(body).to.equal(expectedBody);
					return done();
				});
			});
		});

		it('should be rejected if no token', function(done) {
			let promise = server.awaitForToken(options);
			chai.expect(promise).to.be.rejectedWith('No token');

			return request.post(`http://localhost:${options.port}${options.path}`, {
				form: {
					token: ''
				}
			}
			, function(error, response, body) {
				chai.expect(error).to.not.exist;
				chai.expect(response.statusCode).to.equal(401);
				return getPage('error').then(function(expectedBody) {
					chai.expect(body).to.equal(expectedBody);
					return done();
				});
			});
		});

		return it('should be rejected if token is malformed', function(done) {
			let promise = server.awaitForToken(options);
			chai.expect(promise).to.be.rejectedWith('Invalid token');

			return request.post(`http://localhost:${options.port}${options.path}`, {
				form: {
					token: 'asdf'
				}
			}
			, function(error, response, body) {
				chai.expect(error).to.not.exist;
				chai.expect(response.statusCode).to.equal(401);
				return getPage('error').then(function(expectedBody) {
					chai.expect(body).to.equal(expectedBody);
					return done();
				});
			});
		});
	});
});

