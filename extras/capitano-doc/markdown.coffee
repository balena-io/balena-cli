_ = require('lodash')
utils = require('./utils')

exports.option = (option) ->
	result = utils.parseSignature(option)

exports.command = (command) ->
	result = """
		# #{command.signature}

		#{command.help}\n
	"""

	if not _.isEmpty(command.options)
		result += '\n## Options'

		for option in command.options
			result += """
				\n\n### #{utils.parseSignature(option)}

				#{option.description}
			"""
	return result
