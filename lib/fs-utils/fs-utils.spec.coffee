expect = require('chai').expect
fsUtils = require('./fs-utils')

describe 'FsUtils:', ->

	describe '#isValidPath()', ->

		it 'should return false for invalid paths', ->

			for invalidPath in [
				{ hello: 'world' }
				1234
				[ 1, 2, 3 ]
				undefined
				null
			]
				expect(fsUtils.isValidPath(invalidPath)).to.be.false

		it 'should return true for valid paths', ->

			for validPath in [
				'/Users/johndoe'
				'~/.resin'
				'../parent'
				'./file/../file2'
			]
				expect(fsUtils.isValidPath(validPath)).to.be.true
