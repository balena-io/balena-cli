_ = require('lodash')
path = require('path')
sinon = require('sinon')
chai = require('chai')
chai.use(require('sinon-chai'))
glob = require('glob')
fs = require('fs')
fsPlus = require('fs-plus')
mockFs = require('mock-fs')
expect = chai.expect
plugin = require('./plugin')

describe 'Plugin:', ->

	describe '#getPluginsPathsByGlob()', ->

		describe 'given no glob', ->

			it 'should throw an error', ->
				expect ->
					plugin.getPluginsPathsByGlob()
				.to.throw('Missing glob')

		describe 'given an invalid glob', ->

			it 'should throw an error', ->
				expect ->
					plugin.getPluginsPathsByGlob([ 'glob' ])
				.to.throw('Invalid glob')

		describe 'given a glob that does not matches anything', ->

			beforeEach ->
				@globSyncStub = sinon.stub(glob, 'sync')
				@globSyncStub.returns []

				@plugins = plugin.getPluginsPathsByGlob('myGlob*')

			afterEach ->
				@globSyncStub.restore()

			it 'should return an empty array', ->
				expect(@plugins).to.deep.equal([])

		describe 'given a glob that matches packages', ->

			beforeEach ->
				@getNpmPathsStub = sinon.stub(plugin, 'getNpmPaths')
				@getNpmPathsStub.returns([ '/usr/lib/node_modules' ])

				@globSyncStub = sinon.stub(glob, 'sync')
				@globSyncStub.returns [
					'one'
					'two'
					'three'
				]

				@plugins = plugin.getPluginsPathsByGlob('myGlob*')

			afterEach ->
				@getNpmPathsStub.restore()
				@globSyncStub.restore()

			it 'should return an array', ->
				expect(@plugins).to.be.an.instanceof(Array)

			it 'should have the proper length', ->
				expect(@plugins).to.have.length(3)

			it 'should contain absolute paths', ->
				for pluginPath in @plugins
					expect(fsPlus.isAbsolute(pluginPath)).to.be.true

			it 'should return the appropriate paths', ->
				expect(@plugins[0]).to.equal('/usr/lib/node_modules/one')
				expect(@plugins[1]).to.equal('/usr/lib/node_modules/two')
				expect(@plugins[2]).to.equal('/usr/lib/node_modules/three')

	describe '#getNpmPaths()', ->

		beforeEach ->
			@npmPaths = plugin.getNpmPaths()

		it 'should return an array', ->
			expect(@npmPaths).to.be.an.instanceof(Array)

		it 'should return at least one path', ->
			expect(@npmPaths.length > 1).to.be.true

		it 'should contain absolute paths', ->
			for npmPath in @npmPaths
				expect(fsPlus.isAbsolute(npmPath)).to.be.true

	describe '#getPluginMeta()', ->

		describe 'given an invalid plugin', ->

			beforeEach ->
				mockFs
					'/hello/world':
						'package.json': 'Invalid package.json'

			afterEach ->
				mockFs.restore()

			it 'should throw an error', ->
				expect ->
					plugin.getPluginMeta('/hello/world')
				.to.throw('Invalid package.json: /hello/world/package.json')

		describe 'given a plugin that exists', ->

			beforeEach ->
				mockFs
					'/hello/world':
						'package.json': JSON.stringify({ name: 'myPlugin' })

			afterEach ->
				mockFs.restore()

			it 'should return the parsed object', ->
				result = plugin.getPluginMeta('/hello/world')
				expect(result).to.deep.equal
					name: 'myPlugin'

		describe 'given a plugin that does not exist', ->

			beforeEach ->
				@fsExistsSyncStub = sinon.stub(fs, 'existsSync')
				@fsExistsSyncStub.returns(false)

			afterEach ->
				@fsExistsSyncStub.restore()

			it 'should throw an error', ->
				expect ->
					plugin.getPluginMeta('/hello/world')
				.to.throw('Missing or invalid plugin: /hello/world')
