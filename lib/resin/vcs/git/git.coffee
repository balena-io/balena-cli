fs = require('fs')
fsPlus = require('fs-plus')
_ = require('lodash')
async = require('async')
path = require('path')
gitCli = require('git-cli')
errors = require('../../_errors/errors')
settings = require('../../settings')

# TODO: Refactor somewhere else and reuse trough all modules
# @nodoc
nodeify = (func) ->
	return ->
		return func.call(null, null, arguments...)

# Get git directory for a certain path
#
# By git directory, we mean the hidden .git folder that every git repository have
#
# @private
#
# @param {String} directory the directory path
# @throw {Error} Will throw if directory is not a string
# @return {String} the absolute path to the child .git directory
#
# @note This function doesn't check if the path is valid, it only constructs it.
#
# @example Get git directory
#		result = getGitDirectory('/opt/projects/myapp')
#		console.log(result)
#		# /opt/projects/myapp/.git
#
exports.getGitDirectory = (directory) ->
	return if not directory?
	if not _.isString(directory)
		throw new Error('Invalid git directory')
	return path.join(directory, '.git')

# Get current git directory
#
# Get the path to the .git directory in the current directory
#
# @private
#
# @return {String} the absolute path to the current directory's .git folder
#
# @note The current directory is determined by from where you ran the app
#
# @example Get current git directory
#		$ cd /Users/me/Projects/foobar && resin ...
#		result = getCurrentGitDirectory()
#		console.log(result)
#		# /Users/me/Projects/foobar/.git
#
exports.getCurrentGitDirectory = ->
	currentDirectory = process.cwd()
	return exports.getGitDirectory(currentDirectory)

# Check if a directory is a git repository
#
# @private
#
# @param {String} directory the directory
# @param {Function} callback callback(error, isGitRepository)
#
# @throw {DirectoryDoesntExist} Will throw if directory doesn't exist
#
# @example Is git repository?
#		isGitRepository 'my/git/repo', (error, isGitRepository) ->
#			throw error if error?
#			if isGitRepository
#				console.log('Yes, it\'s a git repo!')
#			else
#				console.log('I should use git here!')
#
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

# Get repository instance
#
# An instance of a [gitCli](https://github.com/tuvistavie/node-git-cli) repository, for internal usage.
#
# @private
#
# @param {String} directory the directory
# @param {Function} callback callback(error, repository)
#
# @throw {Error} Will throw if directory is not a git repository.
#
# @example Get repository instance
#		getRepositoryInstance 'my/git/repo', (error, repository) ->
#			throw error if error?
#			# I can now use gitCli functions on `repository`
#
exports.getRepositoryInstance = (directory, callback) ->
	exports.isGitRepository directory, (error, isGitRepository) ->
		return callback(error) if error?

		if not isGitRepository
			error = new Error("Not a git directory: #{directory}")
			return callback(error)

		gitDirectory = exports.getGitDirectory(directory)
		repository = new gitCli.Repository(gitDirectory)
		return callback(null, repository)

# Check if an application is a git app
#
# @private
#
# @param {Object} application an application from resin API
# @return {Boolean} wheter is a valid git application or not
#
# @note All it does is check if the application object contains a valid git_repository field.
# @todo We should also test that the string contained in git_repository is a valid url.
#
# @example Is valid git application?
#		resin.models.application.get 91, (error, application) ->
#			throw error if error?
#			result = isValidGitApplication(application)
#			console.log(result)
#			# True
#
exports.isValidGitApplication = (application) ->
	gitRepository = application.git_repository
	return false if not gitRepository?
	return false if not _.isString(gitRepository)
	return true

# Check if a repository has a certain remote
#
# @private
#
# @param {Object} repository a repository instance from getRepositoryInstance()
# @param {String} name the name of the remote to check for
# @param {Function} callback callback(error, hasRemote)
#
#	@todo We should extract the logic that lists all remotes into a separate function.
#
# @example Has origin remote?
#		repository = getRepositoryInstance('my/git/repo')
#		hasRemote repository, 'origin', (error, hasRemote) ->
#			throw error if error?
#			if hasRemote
#				console.log('It has an origin remote!')
#			else
#				console.log('It doesn\'t has an origin remote!')
#
exports.hasRemote = (repository, name, callback) ->
	repository.listRemotes null, (error, remotes) ->
		return callback(error) if error?
		hasRemote = _.indexOf(remotes, name) isnt -1
		return callback(null, hasRemote)

# Add a remote to a git repository
#
# @private
#
# @param {Object} repository a repository instance from getRepositoryInstance()
# @param {String} name the name of the remote to add
# @param {String} url url of the new remote
# @param {Function} callback callback(error)
#
# @throw {Error} Will throw if name is not a string
#
# @todo We should check the validity of all arguments.
# @todo This function should be better tested
#
# @example Add resin remote
#		repository = getRepositoryInstance('my/git/repo')
#		addRemote repository, 'resin', 'git@git.resin.io:johndoe/app.git', (error) ->
#			throw error if error?
#
#		$ cd my/git/repo && git remote -v
#		resin	git@git.resin.io:johndoe/app.git (fetch)
#		resin	git@git.resin.io:johndoe/app.git (push)
#
exports.addRemote = (repository, name, url, callback) ->
	if not _.isString(name)
		error = new Error("Invalid remote name: #{name}")
		return callback(error)

	repository.addRemote(name, url, callback)

# Initialize an application project
#
# - Add the corresponding git remote.
#
# @param {Object} application an application from resin API
# @param {String} directory the directory to initialize
# @param {Function} callback callback(error)
#
# @throw {Error} Will throw if application is not a valid application
#
# @note The directory should already be a git repo (maybe we should take care of git init as well here if necessary?)
# @todo This function should be better tested
#
# @example Init project
#		resin.models.application.get 91, (error, application) ->
#			throw error if error?
#
#			initProjectWithApplication application, 'my/new/project', (error) ->
#				throw error if error?
#
exports.initProjectWithApplication = (application, directory, callback) ->

	async.waterfall([

		(callback) ->
			isValid = exports.isValidGitApplication(application)
			return callback() if isValid
			error = new Error("Invalid application: #{application}")
			return callback(error)

		(callback) ->
			exports.getRepositoryInstance(directory, callback)

		(repository, callback) ->
			gitUrl = application.git_repository
			gitRemoteName = settings.get('gitRemote')
			exports.addRemote(repository, gitRemoteName, gitUrl, callback)

	], callback)

# Check if an application was already initialized
#
# It checks if we have a resin remote added already.
#
# @param {String} directory the directory
# @param {Function} callback callback(error, isResinProject)
#
# @todo Find a way to test this function
#
# @example Was application initialized?
#		isResinProject 'my/resin/app', (error, initialized) ->
#			if initialized
#				console.log('It\'s already a resin app!')
#			else
#				console.log('It\'s just a boring project! It should be resinified!')
#
exports.isResinProject = (directory, callback) ->
	async.waterfall([

		(callback) ->
			exports.getRepositoryInstance(directory, callback)

		(repository, callback) ->
			gitRemoteName = settings.get('gitRemote')
			exports.hasRemote(repository, gitRemoteName, callback)

	], callback)
