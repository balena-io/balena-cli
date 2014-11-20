exports.formatLongString = (string, n) ->
	return string if not n?
	splitRegexp = new RegExp(".{1,#{n}}", 'g')
	splittedString = string.match(splitRegexp)
	return splittedString.join('\n')
