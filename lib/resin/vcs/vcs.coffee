git = require('./git/git')

# TODO: We will delegate to only git for now

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
#			resin.vcs.initProjectWithApplication application, 'my/new/project', (error) ->
#				throw error if error?
#
exports.initProjectWithApplication = git.initProjectWithApplication

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
#		resin.vcs.isResinProject 'my/resin/app', (error, initialized) ->
#			if initialized
#				console.log('It\'s already a resin app!')
#			else
#				console.log('It\'s just a boring project! It should be resinified!')
#
exports.isResinProject = git.isResinProject
