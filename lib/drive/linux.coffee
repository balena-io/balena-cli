_ = require('lodash')
os = require('os')
childProcess = require('child_process')
tableParser = require('table-parser')

exports.list = (callback) ->
	childProcess.exec 'lsblk -d --output NAME,MODEL,SIZE', {}, (error, stdout, stderr) ->
		return callback(error) if error?

		if not _.isEmpty(stderr)
			return callback(new Error(stderr))

		result = tableParser.parse(stdout)

		result = _.map result, (row) ->
			return {
				device: "/dev/#{_.first(row.NAME)}"
				description: row.MODEL.join(' ')
				size: _.first(row.SIZE).replace(/,/g, '.')
			}

		return callback(null, result)
