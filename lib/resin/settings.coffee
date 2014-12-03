_ = require('lodash')
path = require('path')
fs = require('fs')
userHome = require('user-home')
helpers = require('./helpers/helpers')
errors = require('./errors/errors')
config = require('./config/config')

settings =
	remoteUrl: 'https://staging.resin.io'
	apiPrefix: '/ewa/'

	dataPrefix: path.join(userHome, '.resin')

	sshKeyWidth: 43

	directories:
		plugins: 'plugins'
		os: 'os'

	files:

		# TODO: Accept an option that overrides this
		config: 'config'

	pubnub:
		subscribe_key: 'sub-c-bbc12eba-ce4a-11e3-9782-02ee2ddab7fe'
		publish_key: 'pub-c-6cbce8db-bfd1-4fdf-a8c8-53671ae2b226'
		ssl: true

	events:
		deviceLogs: 'device-<%= uuid %>-logs'

	urls:
		signup: '/signup'
		preferences: '/preferences'
		keys: '/user/keys'
		identify: '/blink'
		authenticate: '/login_'
		applicationRestart: '/application/<%= id %>/restart'
		sshKey: '/user/keys/<%= id %>'
		download: '/download'

settings.directories = helpers.prefixObjectValuesWithPath(settings.dataPrefix, settings.directories)
settings.files = helpers.prefixObjectValuesWithPath(settings.dataPrefix, settings.files)

# Attempt to load user configuration
_.extend(settings, config.loadUserConfig(settings.files.config) or {})

module.exports = settings
