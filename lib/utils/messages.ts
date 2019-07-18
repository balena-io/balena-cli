const DEBUG_MODE = !!process.env.DEBUG;

export const reachingOut = `\
If you need help, or just want to say hi, don't hesitate in reaching out
through our discussion and support forums at https://forums.balena.io

For bug reports or feature requests, have a look at the GitHub issues or
create a new one at: https://github.com/balena-io/balena-cli/issues/\
`;

const debugHint = `\
Additional information may be available by setting a DEBUG=1 environment
variable: "set DEBUG=1" on a Windows command prompt, or "export DEBUG=1"
on Linux or macOS.\n
`;

export const getHelp = `${DEBUG_MODE ? '' : debugHint}\
If you need help, don't hesitate in contacting our support forums at
https://forums.balena.io

For bug reports or feature requests, have a look at the GitHub issues or
create a new one at: https://github.com/balena-io/balena-cli/issues/\
`;

export const balenaAsciiArt = `\
 _            _
| |__   __ _ | |  ____  _ __    __ _
| '_ \\ / _\` || | / __ \\| '_ \\  / _\` |
| |_) | (_) || ||  ___/| | | || (_) |
|_.__/ \\__,_||_| \\____/|_| |_| \\__,_|
`;

export const registrySecretsHelp = `\
The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:

	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'

If an option is not specified, and a secrets.yml or secrets.json file exists in
the balena directory (usually $HOME/.balena), this file will be used instead.`;

export const gitignoreWarn = `\
------------------------------------------------------------------------------
Deprecation notice: a '.gitignore' file was found and will be used to prevent
the matching files from being uploaded to the docker daemon or balenaCloud
builder. However, this behavior is deprecated: a future major version of the
CLI will look at the '.dockerignore' file only. Please use the '--nogitignore'
or '-I' command-line option to enable the new behavior already now, and supress
this notice. Reference: https://github.com/balena-io/balena-cli/issues/1032
------------------------------------------------------------------------------
`;
