export = {
	title: 'Resin CLI Documentation',
	introduction: `\
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

* set the \`RESINRC_PROXY\` environment variable in the URL format (with protocol, host, port, and optionally the basic auth),
* use the [resin config file](https://www.npmjs.com/package/resin-settings-client#documentation) (project-specific or user-level)
and set the \`proxy\` setting. This can be:
	* a string in the URL format,
	* or an object following [this format](https://www.npmjs.com/package/global-tunnel-ng#options), which allows more control,
* or set the conventional \`https_proxy\` / \`HTTPS_PROXY\` / \`http_proxy\` / \`HTTP_PROXY\`
environment variable (in the same standard URL format).\
`,

	categories: [
		{
			title: 'Application',
			files: [ 'build/actions/app.js' ]
		},
		{
			title: 'Authentication',
			files: [ 'build/actions/auth.js' ]
		},
		{
			title: 'Device',
			files: [ 'build/actions/device.js' ]
		},
		{
			title: 'Environment Variables',
			files: [ 'build/actions/environment-variables.js' ]
		},
		{
			title: 'Help',
			files: [ 'build/actions/help.js' ]
		},
		{
			title: 'Information',
			files: [ 'build/actions/info.js' ]
		},
		{
			title: 'Keys',
			files: [ 'build/actions/keys.js' ]
		},
		{
			title: 'Logs',
			files: [ 'build/actions/logs.js' ]
		},
		{
			title: 'Sync',
			files: [ 'build/actions/sync.js' ]
		},
		{
			title: 'SSH',
			files: [ 'build/actions/ssh.js' ]
		},
		{
			title: 'Notes',
			files: [ 'build/actions/notes.js' ]
		},
		{
			title: 'OS',
			files: [ 'build/actions/os.js' ]
		},
		{
			title: 'Config',
			files: [ 'build/actions/config.js' ]
		},
		{
			title: 'Preload',
			files: [ 'build/actions/preload.js' ]
		},
		{
			title: 'Settings',
			files: [ 'build/actions/settings.js' ]
		},
		{
			title: 'Wizard',
			files: [ 'build/actions/wizard.js' ]
		},
		{
			title: 'Local',
			files: [ 'build/actions/local/index.js' ]
		},
		{
			title: 'Deploy',
			files: [
				'build/actions/build.js',
				'build/actions/deploy.js'
			]
		},
		{
			title: 'Utilities',
			files: [ 'build/actions/util.js' ]
		},
	]
};
