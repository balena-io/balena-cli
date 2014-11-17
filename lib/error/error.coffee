exports.logErrorOrContinue = (func, context) ->
	return ->
		try
			func.apply(context, arguments)
		catch error

			# TODO: There should be a log module that takes
			# care of logging, and this should delegate to it
			console.error("Error: #{error.message}")

			# TODO: Allow errors to save an error code
			# and use that here if it exists
			process.exit(1)

