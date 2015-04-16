_ = require('lodash')
ent = require('ent')
utils = require('./utils')

exports.command = (command) ->
	result = """
		## #{ent.encode(command.signature)}

		#{command.help}\n
	"""

	if not _.isEmpty(command.options)
		result += '\n### Options'

		for option in command.options
			result += """
				\n\n#### #{utils.parseSignature(option)}

				#{option.description}
			"""

		result += '\n'

	return result

exports.category = (category) ->
	result = """
		# #{category.title}
	"""

	for command in category.commands
		result += '\n' + exports.command(command)

	return result

exports.toc = (toc) ->
	result = '''
		# Table of contents\n
	'''

	for category in toc

		result += """
			\n- #{category.title}\n\n
		"""

		for command in category.commands
			result += """
				\t- #{command}\n
			"""

	return result

exports.display = (doc) ->
	result = """
		# #{doc.title}

		#{doc.introduction}

		#{exports.toc(doc.toc)}
	"""

	for category in doc.categories
		result += '\n' + exports.category(category)

	return result
