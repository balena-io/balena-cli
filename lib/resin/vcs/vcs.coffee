git = require('./git/git')

# We will delegate to git for now
exports.initApplication = git.initApplication
exports.wasInitialized = git.wasInitialized
