nock = require('nock')
url = require('url')

chai = require('chai')
chaiAsPromised = require('chai-as-promised')
expect = chai.expect
chai.use(chaiAsPromised)

mock = require('../../tests/utils/mock')
canvas = require('./_canvas')
config = require('../config')

URI =
	application: url.resolve(config.apiPrefix, 'application')

RESPONSE =
	applications:
		d: [
			{ id: 1 }
			{ id: 2 }
		]

describe 'Canvas:', ->

	before ->
		mock.connection.init()

	after ->
		mock.connection.restore()

	beforeEach ->
		nock(config.remoteUrl)
			.get(URI.application)
			.reply(200, RESPONSE.applications)

	it 'should construct the correct url', ->
		promise = canvas.get
			resource: 'application'

		expect(promise).to.become(RESPONSE.applications.d)
