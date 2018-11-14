export = {
	title: 'Balena CLI Documentation',
	introduction: `\
This tool allows you to interact with the balena api from the comfort of your command line.

Please make sure your system meets the requirements as specified in the [README](https://github.com/balena-io/balena-cli).

## Install the CLI

### Npm install

The best supported way to install the CLI is from npm:

	$ npm install balena-cli -g --production --unsafe-perm

\`--unsafe-perm\` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

### Standalone install

Alternatively, if you don't have a node or pre-gyp environment, you can still install the CLI as a standalone
binary. **This is in experimental and may not work perfectly yet in all environments**, but works well in
initial cross-platform testing, so it may be useful, and we'd love your feedback if you hit any issues.

To install the CLI as a standalone binary:

* Download the latest zip for your OS from https://github.com/balena-io/balena-cli/releases.
* Extract the contents, putting the \`balena-cli\` folder somewhere appropriate for your system (e.g. \`C:/balena-cli\`, \`/usr/local/lib/balena-cli\`, etc).
* Add the \`balena-cli\` folder to your \`PATH\`. (
[Windows instructions](https://www.computerhope.com/issues/ch000549.htm),
[Linux instructions](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix),
[OSX instructions](https://stackoverflow.com/questions/22465332/setting-path-environment-variable-in-osx-permanently))
* Running \`balena\` in a fresh command line should print the balena CLI help.

To update in future, simply download a new release and replace the extracted folder.

Have any problems, or see any unexpected behaviour? Please file an issue!

## Getting started

Once you have the CLI installed, you'll need to log in, so it can access everything in your balena account.

To authenticate yourself, run:

	$ balena login

You now have access to all the commands referenced below.

## Proxy support

The CLI does support HTTP(S) proxies.

You can configure the proxy using several methods (in order of their precedence):

* set the \`BALENARC_PROXY\` environment variable in the URL format (with protocol, host, port, and optionally the basic auth),
* use the [balena config file](https://www.npmjs.com/package/balena-settings-client#documentation) (project-specific or user-level)
and set the \`proxy\` setting. This can be:
	* a string in the URL format,
	* or an object following [this format](https://www.npmjs.com/package/global-tunnel-ng#options), which allows more control,
* or set the conventional \`https_proxy\` / \`HTTPS_PROXY\` / \`http_proxy\` / \`HTTP_PROXY\`
environment variable (in the same standard URL format).\
`,

	categories: [
		{
			title: 'Api keys',
			files: ['build/actions/api-key.js'],
		},
		{
			title: 'Application',
			files: ['build/actions/app.js'],
		},
		{
			title: 'Authentication',
			files: ['build/actions/auth.js'],
		},
		{
			title: 'Device',
			files: ['build/actions/device.js'],
		},
		{
			title: 'Environment Variables',
			files: ['build/actions/environment-variables.js'],
		},
		{
			title: 'Help',
			files: ['build/actions/help.js'],
		},
		{
			title: 'Information',
			files: ['build/actions/info.js'],
		},
		{
			title: 'Keys',
			files: ['build/actions/keys.js'],
		},
		{
			title: 'Logs',
			files: ['build/actions/logs.js'],
		},
		{
			title: 'Sync',
			files: ['build/actions/sync.js'],
		},
		{
			title: 'SSH',
			files: ['build/actions/ssh.js'],
		},
		{
			title: 'Notes',
			files: ['build/actions/notes.js'],
		},
		{
			title: 'OS',
			files: ['build/actions/os.js'],
		},
		{
			title: 'Config',
			files: ['build/actions/config.js'],
		},
		{
			title: 'Preload',
			files: ['build/actions/preload.js'],
		},
		{
			title: 'Push',
			files: ['build/actions/push.js'],
		},
		{
			title: 'Settings',
			files: ['build/actions/settings.js'],
		},
		{
			title: 'Wizard',
			files: ['build/actions/wizard.js'],
		},
		{
			title: 'Local',
			files: ['build/actions/local/index.js'],
		},
		{
			title: 'Deploy',
			files: ['build/actions/build.js', 'build/actions/deploy.js'],
		},
		{
			title: 'Platform',
			files: ['build/actions/join.js', 'build/actions/leave.js'],
		},
		{
			title: 'Utilities',
			files: ['build/actions/util.js'],
		},
	],
};
