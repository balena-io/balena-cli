_ = require('lodash')
path = require('path')
capitanodoc = require('../../capitanodoc.json')
markdown = require('./markdown')

result = {}
result.title = capitanodoc.title
result.introduction = capitanodoc.introduction
result.categories = []

for commandCategory in capitanodoc.categories
	category = {}
	category.title = commandCategory.title
	category.commands = []

	for file in commandCategory.files
		actions = require(path.join(process.cwd(), file))

		if actions.signature?
			category.commands.push(_.omit(actions, 'action'))
		else
			for actionName, actionCommand of actions
				category.commands.push(_.omit(actionCommand, 'action'))

	result.categories.push(category)

result.toc = _.cloneDeep(result.categories)
result.toc = _.map result.toc, (category) ->
	category.commands = _.map category.commands, (command) ->
		return {
			signature: command.signature
			anchor: '#' + command.signature
								.replace(/\s/g,'-')
								.replace(/</g, '60-')
								.replace(/>/g, '-62-')
								.replace(/\[/g, '')
								.replace(/\]/g, '-')
								.replace(/--/g, '-')
								.replace(/\.\.\./g, '')
								.replace(/\|/g, '')
								.toLowerCase()
		}

	return category

console.log(markdown.display(result))
