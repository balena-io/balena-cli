_ = require('lodash')
ent = require('ent')

exports.getOptionPrefix = (signature) ->
	if signature.length > 1
		return '--'
	else
		return '-'

exports.getOptionSignature = (signature) ->
	return "#{exports.getOptionPrefix(signature)}#{signature}"

exports.parseSignature = (option) ->
	result = exports.getOptionSignature(option.signature)

	if not _.isEmpty(option.alias)
		if _.isString(option.alias)
			result += ", #{exports.getOptionSignature(option.alias)}"
		else
			for alias in option.alias
				result += ", #{exports.getOptionSignature(option.alias)}"

	if option.parameter?
		result += " <#{option.parameter}>"

	return ent.encode(result)
