# coffeelint: disable=max_line_length

module.exports =
	title: 'Resin CLI Documentation'
	introduction: '''
		This tool allows you to interact with the resin.io api from the comfort of your command line.

		Please make sure your system meets the requirements as specified in the [README](https://github.com/resin-io/resin-cli).

		To get started download the CLI from npm.

			$ npm install resin-cli -g

		Then authenticate yourself:

			$ resin login

		Now you have access to all the commands referenced below.

		## Proxy support

		The CLI does support HTTP(S) proxies.

		You can configure the proxy using several methods (in order of their precedence):

		* set the `RESINRC_PROXY` environment variable in the URL format (with protocol, host, port, and optionally the basic auth),
		* use the [resin config file](https://www.npmjs.com/package/resin-settings-client#documentation) (project-specific or user-level)
		and set the `proxy` setting. This can be:
			* a string in the URL format,
			* or an object following [this format](https://www.npmjs.com/package/global-tunnel-ng#options), which allows more control,
		* or set the conventional `https_proxy` / `HTTPS_PROXY` / `http_proxy` / `HTTP_PROXY`
		environment variable (in the same standard URL format).
	'''

	categories: [
		{
			title: 'Application'
			files: [ 'lib/actions/app.coffee' ]
		},
		{
			title: 'Authentication',
			files: [ 'lib/actions/auth.coffee' ]
		},
		{
			title: 'Device',
			files: [ 'lib/actions/device.coffee' ]
		},
		{
			title: 'Environment Variables',
			files: [ 'lib/actions/environment-variables.coffee' ]
		},
		{
			title: 'Help',
			files: [ 'lib/actions/help.coffee' ]
		},
		{
			title: 'Information',
			files: [ 'lib/actions/info.coffee' ]
		},
		{
			title: 'Keys',
			files: [ 'lib/actions/keys.coffee' ]
		},
		{
			title: 'Logs',
			files: [ 'lib/actions/logs.coffee' ]
		},
		{
			title: 'Sync',
			files: [ 'lib/actions/sync.coffee' ]
		},
		{
			title: 'SSH',
			files: [ 'lib/actions/ssh.coffee' ]
		},
		{
			title: 'Notes',
			files: [ 'lib/actions/notes.coffee' ]
		},
		{
			title: 'OS',
			files: [ 'lib/actions/os.coffee' ]
		},
		{
			title: 'Config',
			files: [ 'lib/actions/config.coffee' ]
		},
		{
			title: 'Settings',
			files: [ 'lib/actions/settings.coffee' ]
		},
		{
			title: 'Wizard',
			files: [ 'lib/actions/wizard.coffee' ]
		},
		{
			title: 'Local',
			files: [ 'lib/actions/local/index.coffee' ]
		},
		{
			title: 'Deploy',
			files: [
				'lib/actions/build.coffee'
				'lib/actions/deploy.coffee'
			]
		}
	]
