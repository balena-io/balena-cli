path = require('path')

module.exports =

	# TODO: Should be configurable
	remoteUrl: 'https://staging.resin.io'
	apiPrefix: '/ewa/'
	dataPrefix: path.join(process.env.HOME, '.resin')
