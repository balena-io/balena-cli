fs = require('fs')
errors = require('../errors/errors')

# Read JSON configuration file
#
# @private
#
# User config loading should be sync, as we need to
# extend this module with the result before exporting
#
# @param {String} configFile configuration file path
# @return {Object} Parsed configuration file
#
# @throw {InvalidConfigFile} Will throw an error if file doesn't exist
# @throw {InvalidConfigFile} Will throw an error if file is not JSON
#
# @example Read config file
#		contents = resin.config.loadUserConfig('/Users/me/resin-custom.json')
#		console.log(contents.remoteUrl)
#
exports.loadUserConfig = (configFile) ->
	return if not fs.existsSync(configFile)

	if not fs.statSync(configFile).isFile()
		throw new errors.InvalidConfigFile(configFile)

	result = fs.readFileSync(configFile, encoding: 'utf8')

	try
		return JSON.parse(result)
	catch error
		throw new errors.InvalidConfigFile(configFile)
