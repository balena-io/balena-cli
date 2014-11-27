_ = require('lodash')
chai = require('chai')
chai.use(require('sinon-chai'))
expect = chai.expect
sinon = require('sinon')
resin = require('../resin')
pluginLoader = require('../plugin-loader/plugin-loader')

describe 'Plugin Loader:', ->

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
