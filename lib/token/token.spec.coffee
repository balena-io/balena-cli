expect = require('chai').expect
async = require('async')
token = require('./token')

johnDoeFixture = require('../../tests/fixtures/johndoe.json')
janeDoeFixture = require('../../tests/fixtures/janedoe.json')

describe 'Token:', ->

	describe 'given a user that is logged in', ->

		beforeEach (done) ->
			token.saveToken(johnDoeFixture.token, done)

		describe '#saveToken()', ->

			it 'should overwrite the old token', (done) ->
				async.waterfall [

					(callback) ->
						token.getToken(callback)

					(savedToken, callback) ->
						expect(savedToken).to.equal(johnDoeFixture.token)
						token.saveToken(janeDoeFixture.token, callback)

					(savedToken, callback) ->
						token.getToken(callback)

					(savedToken, callback) ->
						expect(savedToken).to.equal(janeDoeFixture.token)
						return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

		describe '#hasToken()', ->

			it 'should return true', (done) ->
				token.hasToken (hasToken) ->
					expect(hasToken).to.be.true
					done()

		describe '#getToken()', ->

			it 'should return the token', (done) ->
				token.getToken (error, savedToken) ->
					expect(error).to.not.exist
					expect(savedToken).to.equal(johnDoeFixture.token)
					done()

		describe '#clearToken()', ->

			it 'should effectively clear the token', (done) ->
				async.waterfall [

					(callback) ->
						token.getToken(callback)

					(savedToken, callback) ->
						expect(savedToken).to.equal(johnDoeFixture.token)
						token.clearToken(callback)

					(callback) ->
						token.getToken(callback)

					(savedToken, callback) ->
						expect(savedToken).to.be.undefined
						return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

	describe 'given a user that didn\'t log in', ->

		beforeEach (done) ->
			token.clearToken(done)

		describe '#saveToken()', ->

			it 'should save a token', (done) ->
				async.waterfall [

					(callback) ->
						token.saveToken(johnDoeFixture.token, callback)

					(callback) ->
						token.getToken(callback)

					(savedToken, callback) ->
						expect(savedToken).to.equal(johnDoeFixture.token)
						return callback()

				], (error) ->
					expect(error).to.not.exist
					done()

		describe '#hasToken()', ->

			it 'should return false', (done) ->
				token.hasToken (hasToken) ->
					expect(hasToken).to.be.false
					done()

		describe '#getToken()', ->

			it 'should return undefined', (done) ->
				token.getToken (error, savedToken) ->
					expect(error).to.not.exist
					expect(savedToken).to.be.undefined
					done()
