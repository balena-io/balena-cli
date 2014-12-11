fs = require('fs')
fsPlus = require('fs-plus')
_ = require('lodash')
async = require('async')
path = require('path')
gitCli = require('git-cli')
errors = require('../../errors/errors')
settings = require('../../settings')

nodeify = (func) ->
	return ->
		return func.call(null, null, arguments...)

exports.getGitDirectory = (directory) ->
	return if not directory?
	if not _.isString(directory)
		throw new Error('Invalid git directory')
	return path.join(directory, '.git')

exports.getCurrentGitDirectory = ->
	currentDirectory = process.cwd()
	return exports.getGitDirectory(currentDirectory)

exports.isGitRepository = (directory, callback) ->
	gitDirectory = exports.getGitDirectory(directory)

	async.waterfall([

		(callback) ->
			fs.exists(directory, nodeify(callback))

		(exists, callback) ->
			return callback() if exists
			error = new errors.DirectoryDoesntExist(directory)
			return callback(error)

		(callback) ->
			fsPlus.isDirectory(gitDirectory, nodeify(callback))

	], callback)

exports.getRepository = (directory, callback) ->
	exports.isGitRepository directory, (error, isGitRepository) ->
		return callback(error) if error?

		if not isGitRepository
			error = new Error("Not a git directory: #{directory}")
			return callback(error)

		gitDirectory = exports.getGitDirectory(directory)
		repository = new gitCli.Repository(gitDirectory)
		return callback(null, repository)

exports.isValidGitApplication = (application) ->
	gitRepository = application.git_repository
	return false if not gitRepository?
	return false if not _.isString(gitRepository)
	return true

exports.hasRemote = (repository, name, callback) ->
	repository.listRemotes null, (error, remotes) ->
		return callback(error) if error?
		hasRemote = _.indexOf(remotes, name) isnt -1
		return callback(null, hasRemote)

# TODO: This should be better tested
exports.addRemote = (repository, name, url, callback) ->
	if not _.isString(name)
		error = new Error("Invalid remote name: #{name}")
		return callback(error)

	repository.addRemote(name, url, callback)

# TODO: This should be better tested
exports.initApplication = (application, directory, callback) ->

	async.waterfall([

		(callback) ->
			isValid = exports.isValidGitApplication(application)
			return callback() if isValid
			error = new Error("Invalid application: #{application}")
			return callback(error)

		(callback) ->
			exports.getRepository(directory, callback)

		(repository, callback) ->
			gitUrl = application.git_repository
			gitRemoteName = settings.get('gitRemote')
			exports.addRemote(repository, gitRemoteName, gitUrl, callback)

	], callback)

# TODO: Find a sane way to test this
exports.wasInitialized = (directory, callback) ->
	async.waterfall([

		(callback) ->
			exports.getRepository(directory, callback)

		(repository, callback) ->
			gitRemoteName = settings.get('gitRemote')
			exports.hasRemote(repository, gitRemoteName, callback)

	], callback)
