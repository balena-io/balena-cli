fs = require('fs')
errors = require('../errors/errors')

# User config loading should be sync, as we need to
# extend this module with the result before exporting
exports.loadUserConfig = (configFile) ->
	return if not fs.existsSync(configFile)

	if not fs.statSync(configFile).isFile()
		throw new errors.InvalidConfigFile(configFile)

	result = fs.readFileSync(configFile, encoding: 'utf8')

	try
		return JSON.parse(result)
	catch error
		throw new errors.InvalidConfigFile(configFile)
