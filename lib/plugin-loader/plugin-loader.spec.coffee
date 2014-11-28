_ = require('lodash')
chai = require('chai')
chai.use(require('sinon-chai'))
chai.use(require('chai-things'))
expect = chai.expect
path = require('path')
sinon = require('sinon')
mock = require('../../tests/utils/mock')
resin = require('../resin')
pluginLoader = require('../plugin-loader/plugin-loader')

FILESYSTEM =
	text:
		name: 'text'
		contents: 'Hello World'
	invalidPackage:
		name: 'invalidPackage'
		contents: {}
	invalidPackageWithPackageJSON:
		name: 'invalidPackageWithPackageJSON'
		contents:
			'package.json': ''
	validPackage:
		name: 'validPackage'
		contents:
			'package.json': JSON.stringify
				name: 'myPackage'
				main: 'app.js'
			'app.js': 'module.exports = function() {};'
	validPackageNoFunction:
		name: 'validPackageNoFunction'
		contents:
			'package.json': JSON.stringify
				name: 'myPackage'
				main: 'app.js'
			'app.js': 'module.exports = {};'

FILESYSTEM.pluginsDirectory =
	name: 'pluginsDirectory'
	contents:
		firstPlugin: FILESYSTEM.validPackage.contents
		secondPlugin: FILESYSTEM.validPackage.contents
		thirdPlugin: FILESYSTEM.validPackage.contents
FILESYSTEM.invalidPluginsDirectory =
	name: 'invalidPluginsDirectory'
	contents:
		firstPlugin: FILESYSTEM.validPackage.contents
		secondPlugin: FILESYSTEM.validPackage.contents
		thirdPlugin: 'Hello World'

compareArrays = (arr1, arr2) ->
	expect(arr1.length).to.equal(arr2.length)
	for item in arr2
		expect(arr1).to.include(item)

describe 'Plugin Loader:', ->

	beforeEach ->
		mock.fs.init(FILESYSTEM)

	afterEach ->
		mock.fs.restore()

	describe '#use()', ->

		it 'should pass the resin object to the function', ->
			spy = sinon.spy()
			pluginLoader.use(spy)
			expect(spy).to.have.been.calledWith(resin)

		it 'should throw an error if plugin is not a function', ->
			for nonFunction in [
				undefined
				null
				[ 1, 2, 3 ]
				123
				'Hello World'
				{ hello: 'world' }
			]
				func = _.partial(pluginLoader.use, nonFunction)
				expect(func).to.throw(Error)

	describe '#loadPlugin()', ->

		it 'should return an error if path doesn\'t exist', (done) ->
			pluginLoader.loadPlugin 'foobar', (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if path is not a directory', (done) ->
			pluginLoader.loadPlugin FILESYSTEM.text.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if there is no package.json', (done) ->
			pluginLoader.loadPlugin FILESYSTEM.invalidPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if package.json is missing main', (done) ->
			pluginPackage = FILESYSTEM.invalidPackageWithPackageJSON
			pluginLoader.loadPlugin pluginPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return the entry point if package is valid', (done) ->
			pluginPackage = FILESYSTEM.validPackage
			pluginLoader.loadPlugin pluginPackage.name, (error, plugin) ->
				expect(error).to.not.exist
				expect(_.isFunction(plugin)).to.be.true
				done()

		it 'should return the entry point is not a function', (done) ->
			pluginPackage = FILESYSTEM.validPackageNoFunction
			pluginLoader.loadPlugin pluginPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

	describe '#readPluginsDirectory()', ->

		it 'should fail if input is not a directory', (done) ->
			pluginsDirectory = FILESYSTEM.text.name
			pluginLoader.readPluginsDirectory pluginsDirectory, (error, plugins) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugins).to.not.exist
				done()

		it 'should return a list of all files inside plugins directory', (done) ->
			pluginsDirectory = FILESYSTEM.pluginsDirectory
			pluginLoader.readPluginsDirectory pluginsDirectory.name, (error, plugins) ->
				expect(error).to.not.exist

				expectedPlugins = _.keys(pluginsDirectory.contents)

				expectedPlugins = _.map expectedPlugins, (value) ->
					return path.join(pluginsDirectory.name, value)

				compareArrays(plugins, expectedPlugins)
				done()

		it 'should return omit files inside plugins directory', (done) ->
			pluginsDirectory = FILESYSTEM.invalidPluginsDirectory
			pluginLoader.readPluginsDirectory pluginsDirectory.name, (error, plugins) ->
				expect(error).to.not.exist

				expectedPlugins = _.keys _.omit pluginsDirectory.contents, (value, key) ->
					return _.isString(value)

				expectedPlugins = _.map expectedPlugins, (value) ->
					return path.join(pluginsDirectory.name, value)

				compareArrays(plugins, expectedPlugins)
				done()

	describe '#loadPluginsDirectory()', ->

		it 'should not return an error for all valid plugins', (done) ->
			pluginsDirectory = FILESYSTEM.pluginsDirectory
			pluginLoader.loadPluginsDirectory pluginsDirectory.name, (error) ->
				expect(error).to.not.exist
				done()

		it 'should call use for all plugins', (done) ->
			pluginsDirectory = FILESYSTEM.pluginsDirectory
			numberOfPlugins = _.keys(pluginsDirectory.contents).length

			mock.fs.restore()
			useSpy = sinon.spy(pluginLoader, 'use')
			mock.fs.init(FILESYSTEM)

			pluginLoader.loadPluginsDirectory pluginsDirectory.name, (error) ->
				expect(error).to.not.exist
				expect(useSpy.callCount).to.equal(numberOfPlugins)

				for arg in _.flatten(useSpy.args)
					expect(_.isFunction(arg)).to.be.true

				useSpy.restore()
				done()
