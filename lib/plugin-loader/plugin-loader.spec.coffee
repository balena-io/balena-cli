_ = require('lodash')
chai = require('chai')
chai.use(require('sinon-chai'))
expect = chai.expect
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

	describe '#loadPackage()', ->

		it 'should return an error if path doesn\'t exist', (done) ->
			pluginLoader.loadPackage 'foobar', (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if path is not a directory', (done) ->
			pluginLoader.loadPackage FILESYSTEM.text.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if there is no package.json', (done) ->
			pluginLoader.loadPackage FILESYSTEM.invalidPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return an error if package.json is missing main', (done) ->
			pluginPackage = FILESYSTEM.invalidPackageWithPackageJSON
			pluginLoader.loadPackage pluginPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()

		it 'should return the entry point if package is valid', (done) ->
			pluginPackage = FILESYSTEM.validPackage
			pluginLoader.loadPackage pluginPackage.name, (error, plugin) ->
				expect(error).to.not.exist
				expect(_.isFunction(plugin)).to.be.true
				done()

		it 'should return the entry point is not a function', (done) ->
			pluginPackage = FILESYSTEM.validPackageNoFunction
			pluginLoader.loadPackage pluginPackage.name, (error, plugin) ->
				expect(error).to.be.an.instanceof(Error)
				expect(plugin).to.not.exist
				done()
