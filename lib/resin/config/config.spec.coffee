_ = require('lodash')
chai = require('chai')
expect = chai.expect
config = require('./config')
mock = require('../../../tests/utils/mock')

FILESYSTEM =
	config:
		name: 'config'
		contents: JSON.stringify
			directories:
				plugins: 'myPlugins'
			remoteUrl: 'http://localhost:9001'
	directoryConfig:
		name: 'directoryConfig'
		contents: {}
	notJSON:
		name: 'notJSON'
		contents: 'Not JSON content'

describe 'Config:', ->

	beforeEach ->
		mock.fs.init(FILESYSTEM)

	afterEach ->
		mock.fs.restore()

	describe '#loadUserConfig()', ->

		it 'should load the default config file', ->
			configFile = FILESYSTEM.config.name
			result = config.loadUserConfig(configFile)
			expectedContents = JSON.parse(FILESYSTEM.config.contents)
			expect(result).to.deep.equal(expectedContents)

		it 'should return undefined if config file does not exist', ->
			configFile = 'foobar'
			result = config.loadUserConfig(configFile)
			expect(result).to.be.undefined

		it 'should throw an error if config file is not a file', ->
			configFile = FILESYSTEM.directoryConfig.name
			func = _.partial(config.loadUserConfig, configFile)
			expect(func).to.throw(Error)

		it 'should throw an error if config is not a json file', ->
			configFile = FILESYSTEM.notJSON.name
			func = _.partial(config.loadUserConfig, configFile)
			expect(func).to.throw(Error)
