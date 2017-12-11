
windowSize = {}

updateWindowSize = ->
	size = require('window-size').get()
	windowSize.width = size.width
	windowSize.height = size.height

process.stdout.on('resize', updateWindowSize)

module.exports = (stream = process.stdout) ->
	# make sure we get initial metrics
	updateWindowSize()

	currentWindowSize = ->
		# always return a copy
		width: windowSize.width
		height: windowSize.height

	hideCursor = ->
		stream.write('\u001B[?25l')

	showCursor = ->
		stream.write('\u001B[?25h')

	cursorUp = (rows = 0) ->
		stream.write("\u001B[#{rows}A")

	cursorDown = (rows = 0) ->
		stream.write("\u001B[#{rows}B")

	cursorHidden = ->
		Promise = require('bluebird')
		Promise.try(hideCursor).disposer(showCursor)

	write = (str) ->
		stream.write(str)

	writeLine = (str) ->
		stream.write("#{str}\n")

	clearLine = ->
		stream.write('\u001B[2K\r')

	replaceLine = (str) ->
		clearLine()
		write(str)

	deleteToEnd = ->
		stream.write('\u001b[0J')

	return {
		stream
		currentWindowSize
		hideCursor
		showCursor
		cursorHidden
		cursorUp
		cursorDown
		write
		writeLine
		clearLine
		replaceLine
		deleteToEnd
	}
