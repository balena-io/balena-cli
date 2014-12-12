_ = require('lodash')
path = require('path')
sinon = require('sinon')
gitCli = require('git-cli')
chai = require('chai')
expect = chai.expect
git = require('./git')
mock = require('../../../../tests/utils/mock')
settings = require('../../settings')

describe 'VCS Git:', ->

	describe '#getGitDirectory()', ->

		it 'should append .git', ->
			result = git.getGitDirectory('foobar')
			expect(result).to.equal("foobar#{path.sep}.git")

		it 'should return undefined if no directory', ->
			for input in [ undefined, null ]
				result = git.getGitDirectory(input)
				expect(result).to.be.undefined

		it 'should throw an error if directory is not a string', ->
			for input in [
				123
				{ hello: 'world' }
				[ 1, 2, 3 ]
				true
				false
			]
				func = _.partial(git.getGitDirectory, input)
				expect(func).to.throw(Error)

	describe '#getCurrentGitDirectory()', ->

		it 'should append .git to current working directory', ->
			result = git.getCurrentGitDirectory()
			expectedResult = path.join(process.cwd(), '.git')
			expect(result).to.equal(expectedResult)

	describe '#getRepositoryInstance()', ->

		filesystem =
			gitRepo:
				name: '/repo'
				contents:
					'.git': {}

		beforeEach ->
			mock.fs.init(filesystem)

		afterEach ->
			mock.fs.restore()

		it 'should throw an error if directory does not exist', (done) ->
			git.getRepositoryInstance '/foobar', (error, repository) ->
				expect(error).to.be.an.instanceof(Error)
				expect(repository).to.not.exist
				done()

		it 'should return a repository', (done) ->
			repo = filesystem.gitRepo
			git.getRepositoryInstance repo.name, (error, repository) ->
				expect(error).to.not.exist
				expect(repository).to.exist

				expectedPath = path.join(repo.name, '.git')
				expect(repository.path).to.equal(expectedPath)
				done()

	describe '#isValidGitApplication()', ->

		it 'should return false if no git_repository', ->
			result = git.isValidGitApplication({})
			expect(result).to.be.false

		it 'should return false if git_repository is not a string', ->
			result = git.isValidGitApplication(git_repository: [ 1, 2, 3 ])
			expect(result).to.be.false

		it 'should return true if git_repository is valid', ->
			repositoryUrl = 'git@git.resin.io:johndoe/app.git'
			result = git.isValidGitApplication(git_repository: repositoryUrl)
			expect(result).to.be.true

	describe '#hasRemote()', ->

		mockListRemotes = (result) ->
			return (options, callback) ->
				return callback(null, result)

		beforeEach ->
			@repository =
				listRemotes: mockListRemotes([ 'resin', 'origin' ])

		it 'should return true if it has the remote', (done) ->
			git.hasRemote @repository, 'resin', (error, hasRemote) ->
				expect(error).to.not.exist
				expect(hasRemote).to.be.true
				done()

		it 'should return false if it does not have the remote', (done) ->
			git.hasRemote @repository, 'foobar', (error, hasRemote) ->
				expect(error).to.not.exist
				expect(hasRemote).to.be.false
				done()

	describe '#addRemote()', ->

		beforeEach ->
			@repository =
				addRemote: (name, url, callback) ->
					return callback()

			@name = 'resin'
			@url = 'git@git.resin.io:johndoe/app.git'

		# TODO: It'd be nice if we could actually test that
		# the remote was added to .git/config, but sadly
		# mockFs and child_process.exec don't seem to play well together.

		it 'should call repository.addRemote with the correct parameters', (done) ->
			addRemoteSpy = sinon.spy(@repository, 'addRemote')

			callback = (error) =>
				expect(error).to.not.exist
				expect(addRemoteSpy).to.have.been.calledWithExactly(@name, @url, callback)
				addRemoteSpy.restore()
				done()

			git.addRemote(@repository, @name, @url, callback)

		it 'should throw an error if name is not a string', (done) ->
			git.addRemote @repository, undefined, @url, (error) ->
				expect(error).to.be.an.instanceof(Error)
				done()

	describe '#isGitRepository()', ->

		filesystem =
			gitRepo:
				name: '/repo'
				contents:
					'.git': {}
			notGitRepo:
				name: '/not-repo'
				contents: {}
			invalidGitRepo:
				name: '/invalid-repo'
				contents:
					'.git': 'Plain text file'

		beforeEach ->
			mock.fs.init(filesystem)

		afterEach ->
			mock.fs.restore()

		it 'should return true if it has a .git directory', (done) ->
			git.isGitRepository filesystem.gitRepo.name, (error, isGitRepo) ->
				expect(error).to.not.exist
				expect(isGitRepo).to.be.true
				done()

		it 'should return false if it does not have a .git directory', (done) ->
			git.isGitRepository filesystem.notGitRepo.name, (error, isGitRepo) ->
				expect(error).to.not.exist
				expect(isGitRepo).to.be.false
				done()

		it 'should throw an error if directory does not exist', (done) ->
			git.isGitRepository '/nonexistentdir', (error, isGitRepo) ->
				expect(error).to.be.an.instanceof(Error)
				expect(isGitRepo).to.be.undefined
				done()

		it 'should return false it .git is a file', (done) ->
			git.isGitRepository filesystem.invalidGitRepo.name, (error, isGitRepo) ->
				expect(error).to.not.exist
				expect(isGitRepo).to.be.false
				done()

	describe '#initProjectWithApplication()', ->

		filesystem =
			gitRepo:
				name: '/repo'
				contents:
					'.git': {}

			notGitRepo:
				name: '/not-repo'
				contents: {}

		beforeEach ->
			mock.fs.init(filesystem)
			@application =
				git_repository: 'git@git.resin.io:johndoe/app.git'

		afterEach ->
			mock.fs.restore()

		it 'should return an error if directory is not a git repo', (done) ->
			git.initProjectWithApplication @application, filesystem.notGitRepo.name, (error) ->
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should return an error if application does not contain a git repo url', (done) ->
			git.initProjectWithApplication {}, filesystem.gitRepo.name, (error) ->
				expect(error).to.be.an.instanceof(Error)
				done()

		it 'should add the remote', (done) ->
			mock.fs.restore()
			addRemoteStub = sinon.stub(git, 'addRemote')
			addRemoteStub.yields(null)
			mock.fs.init(filesystem)

			git.initProjectWithApplication @application, filesystem.gitRepo.name, (error) =>
				expect(error).to.not.exist
				expect(addRemoteStub).to.have.been.calledOnce

				# TODO: There should be a better way to test this
				args = addRemoteStub.firstCall.args
				expect(args[1]).to.equal(settings.get('gitRemote'))
				expect(args[2]).to.equal(@application.git_repository)

				addRemoteStub.restore()
				done()

