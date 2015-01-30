_ = require('lodash')
os = require('os')
childProcess = require('child_process')
tableParser = require('table-parser')

exports.list = (callback) ->
	childProcess.exec 'diskutil list', {}, (error, stdout, stderr) ->
		return callback(error) if error?

		if not _.isEmpty(stderr)
			return callback(new Error(stderr))

		result = tableParser.parse(stdout)

		result = _.map result, (row) ->
			return _.compact _.flatten _.values(row)

		result = _.filter result, (row) ->
			return row[0] is '0:'

		result = _.map result, (row) ->
			return _.rest(row)

		result = _.map result, (row) ->

			device = row.pop()
			sizeMeasure = row.pop()
			size = row.pop()

			return {
				device: "/dev/#{device}"
				size: "#{size}#{sizeMeasure}"
				description: row.join(' ')
			}

		return callback(null, result)
