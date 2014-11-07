_ = require('lodash')

# TODO: There should be more complex checks here
exports.isValidPath = (p) ->
	return _.isString(p)
