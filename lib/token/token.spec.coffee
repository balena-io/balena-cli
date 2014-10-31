expect = require('chai').expect
token = require('./token')

johnDoeFixture = require('../../tests/fixtures/johndoe.json')
janeDoeFixture = require('../../tests/fixtures/janedoe.json')

describe 'Token', ->

	describe 'given a user that is logged in', ->

		beforeEach ->
			token.saveToken(johnDoeFixture.token)

		describe '#saveToken()', ->

			it 'should overwrite the old token', ->
				expect(token.getToken()).to.equal(johnDoeFixture.token)
				token.saveToken(janeDoeFixture.token)
				expect(token.getToken()).to.not.equal(johnDoeFixture.token)
				expect(token.getToken()).to.equal(janeDoeFixture.token)

		describe '#hasToken()', ->

			it 'should return true', ->
				expect(token.hasToken()).to.be.true

		describe '#getToken()', ->

			it 'should return the token', ->
				expect(token.getToken()).to.equal(johnDoeFixture.token)

		describe '#clearToken()', ->

			it 'should effectively clear the token', ->
				expect(token.getToken()).to.equal(johnDoeFixture.token)
				token.clearToken()
				expect(token.getToken()).to.be.undefined

	describe 'given a user that didn\'t log in', ->

		beforeEach ->
			token.clearToken()

		describe '#saveToken()', ->

			it 'should save a token', ->
				token.saveToken(johnDoeFixture.token)
				expect(token.getToken()).to.equal(johnDoeFixture.token)

		describe '#hasToken()', ->

			it 'should return false', ->
				expect(token.hasToken()).to.be.false

		describe '#getToken()', ->

			it 'should return undefined', ->
				expect(token.getToken()).to.be.undefined

		describe '#clearToken()', ->

			it 'should not throw an error', ->
				expect(token.clearToken).to.not.throw(Error)
