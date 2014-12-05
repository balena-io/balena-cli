_ = require('lodash')
path = require('path')
sinon = require('sinon')
chai = require('chai')
expect = chai.expect
CliConf = require('./cli-conf')
mock = require('../../tests/utils/mock')

describe 'CliConf:', ->

	describe 'given an empty conf', ->

		beforeEach ->
			@conf = new CliConf()

		describe '#set()', ->

			it 'should be able to set values', ->
				key = 'foo'
				value = 'bar'
				expect(@conf.get(key)).to.not.exist
				@conf.set(key, value)
				expect(@conf.get(key)).to.exist

		describe '#get()', ->

			it 'should be able to get values', ->
				key = 'foo'
				value = 'bar'
				@conf.set(key, value)
				expect(@conf.get(key)).to.equal(value)

			it 'should be able to get nested values', ->
				@conf._data.nested =
					value: 'ok'

				expect(@conf.get('nested.value')).to.equal('ok')

			it 'should return undefined if not nested value', ->
				expect(@conf.get('unexistent.nested.value')).to.be.undefined

			it 'should return undefined if value does not exist', ->
				expect(@conf.get('unknownKey')).to.be.undefined

			it 'should return undefined if no key', ->
				expect(@conf.get()).to.be.undefined

		describe '#has()', ->

			it 'should return check if data has key', ->
				key = 'foo'
				value = 'bar'

				expect(@conf.has(key)).to.be.false
				@conf.set(key, value)
				expect(@conf.has(key)).to.be.true

		describe '#extendWithFile()', ->

			filesystem =
				userConfig:
					name: '/userConfig'
					contents: JSON.stringify
						remoteUrl: 'https://alpha.resin.io'
				notJSONUserConfig:
					name: '/notJSONUserConfig'
					contents: 'Just a plain file'

			beforeEach ->
				mock.fs.init(filesystem)

			afterEach ->
				mock.fs.restore()

			describe 'if no file is passed', ->

				it 'should return undefined', ->
					expect(@conf.extendWithFile()).to.be.undefined

				it 'should keep the content unmodified', ->
					data = _.cloneDeep(@conf._data)
					@conf.extendWithFile()
					expect(@conf._data).to.deep.equal(data)

			describe 'if file does not exist', ->

				it 'should return undefined', ->
					expect(@conf.extendWithFile('/unexistent_file')).to.be.undefined

				it 'should keep the content unmodified', ->
					data = _.cloneDeep(@conf._data)
					@conf.extendWithFile('/unexistent_file')
					expect(@conf._data).to.deep.equal(data)

			it 'should throw an error if file is not a json file', ->
				func = _.partial(@conf.extendWithFile, filesystem.notJSONUserConfig.name)
				expect(func).to.throw(Error)

			it 'should extend data with a file', ->
				expect(@conf.isEmpty()).to.be.true
				@conf.extendWithFile(filesystem.userConfig.name)
				expectedContent = JSON.parse(filesystem.userConfig.contents)
				expect(@conf._data).to.deep.equal(expectedContent)

		describe '#isEmpty()', ->

			it 'should return true', ->
				expect(@conf.isEmpty()).to.be.true

	describe 'given a conf with default values', ->

		object =
			one: 'first'
			two: 'second'

		beforeEach ->
			@conf = new CliConf(default: object)

		it 'should have the data', ->
			expect(@conf._data).to.deep.equal(object)

		describe '#isEmpty()', ->

			it 'should return false', ->
				expect(@conf.isEmpty()).to.be.false

	describe '#extend()', ->

		beforeEach ->
			@conf = new CliConf
				default:
					greeting: 'Hi'

		it 'should override data values', ->
			object =
				greeting: 'Hola'
				name: 'John Doe'

			@conf.extend(object)
			expect(@conf._data).to.deep.equal(object)

		it 'should handle multiple overrides', ->
			@conf.extend {
				greeting: 'Hola'
				name: 'John Doe'
			}, {
				greeting: 'Pronto'
			}

			expect(@conf._data).to.deep.equal
				greeting: 'Pronto'
				name: 'John Doe'

	describe 'given a supplied user config default', ->

		options =
			keys:
				userConfig: 'config.user'
			default:
				remoteUrl: 'https://staging.resin.io'
				config:
					user: '/Users/jviotti/.resin/config'

		filesystem =
			userConfig:
				name: options.default.config.user
				contents: JSON.stringify
					remoteUrl: 'https://alpha.resin.io'

		beforeEach ->
			mock.fs.init(filesystem)
			@conf = new CliConf(options)

		afterEach ->
			mock.fs.restore()

		it 'should load that file and extend _data', ->
			parsedUserConfig = JSON.parse(filesystem.userConfig.contents)
			expectedResult = _.extend(_.cloneDeep(options.default), parsedUserConfig)
			expect(@conf._data).to.deep.equal(expectedResult)

	describe 'given a supplied user and local config', ->

		options =
			keys:
				userConfig: 'config.user'
				localConfig: 'config.local'
			default:
				remoteUrl: 'https://staging.resin.io'
				config:
					user: '/Users/jviotti/.resin/config'
					local: '.resinconfig'

		filesystem =
			localConfig:
				name: path.join(process.cwd(), options.default.config.local)
				contents: JSON.stringify
					remoteUrl: 'https://localhost.resin.io'
			userConfig:
				name: options.default.config.user
				contents: JSON.stringify
					remoteUrl: 'https://alpha.resin.io'

		beforeEach ->
			mock.fs.init(filesystem)
			@conf = new CliConf(options)

		afterEach ->
			mock.fs.restore()

		it 'local config should have precedence', ->
			parsedUserConfig = JSON.parse(filesystem.userConfig.contents)
			parsedLocalConfig = JSON.parse(filesystem.localConfig.contents)
			defaultsCopy = _.cloneDeep(options.default)

			expectedResult = _.extend(defaultsCopy, parsedUserConfig, parsedLocalConfig)
			expect(@conf._data).to.deep.equal(expectedResult)

	describe 'given supplied keys', ->

		keys =
			userConfig: 'config.user'
			localConfig: 'config.local'

		beforeEach ->
			@conf = new CliConf({ keys })

		describe '#_getOptionKey()', ->

			it 'should be able to get a key', ->
				result = @conf._getOptionKey('userConfig')
				expect(result).to.equal(keys.userConfig)

			it 'should return undefined if no input', ->
				result = @conf._getOptionKey()
				expect(result).to.be.undefined

			it 'should return undefined if key does not exist', ->
				result = @conf._getOptionKey('nonexistentkey')
				expect(result).to.be.undefined

	describe.only 'given a user config that changes the local config file name', ->
		options =
			keys:
				userConfig: 'config.user'
				localConfig: 'config.local'
			default:
				remoteUrl: 'https://staging.resin.io'
				config:
					user: '/Users/jviotti/.resin/config'
					local: '.resinconfig'

		newLocalConfig = '.resinrc'

		filesystem =
			userConfig:
				name: options.default.config.user
				contents: JSON.stringify
					config:
						local: newLocalConfig
			localConfig:
				name: path.join(process.cwd(), newLocalConfig)
				contents: JSON.stringify
					remoteUrl: 'https://alpha.resin.io'

		beforeEach ->
			mock.fs.init(filesystem)
			@conf = new CliConf(options)

		afterEach ->
			mock.fs.restore()

		it 'should make use of the renamed config file name', ->
			parsedUserConfig = JSON.parse(filesystem.userConfig.contents)
			parsedLocalConfig = JSON.parse(filesystem.localConfig.contents)
			defaultsCopy = _.cloneDeep(options.default)

			expect(@conf._getLocalConfigPath()).to.equal(filesystem.localConfig.name)

			expectedResult = _.extend(defaultsCopy, parsedUserConfig, parsedLocalConfig)
			expect(@conf._data).to.deep.equal(expectedResult)

	describe '#parse()', ->

		beforeEach ->
			@conf = new CliConf()

		it 'should use parse JSON by default', ->
			input = '{ "hello": 123 }'
			result = @conf.parse(input)
			parsedInput = JSON.parse(input)
			expect(result).to.deep.equal(parsedInput)

		it 'should be able to replace parse function with options', ->
			parseFunction = _.identity
			@conf = new CliConf(configFileParse: parseFunction)

			expect(@conf._options.configFileParse).to.equal(parseFunction)
			input = 'Hello'
			result = @conf.parse(input)
			expect(result).to.equal(input)

	describe '#_getLocalConfigPath()', ->

		it 'should contruct the path correctly', ->
			filename = 'resin'
			@conf = new CliConf
				keys:
					localConfig: 'config.local'
				default:
					config:
						local: filename

			expectedPath = path.join(process.cwd(), filename)
			expect(@conf._getLocalConfigPath()).to.equal(expectedPath)

		it 'should return undefined if no local path', ->
			@conf = new CliConf()
			expect(@conf._getLocalConfigPath()).to.be.undefined
