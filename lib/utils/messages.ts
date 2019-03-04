const DEBUG_MODE = !!process.env.DEBUG;

export const reachingOut = `\
If you need help, or just want to say hi, don't hesitate in reaching out at:

  Forums: https://forums.balena.io
  GitHub: https://github.com/balena-io/balena-cli/issues/new\
`;

const debugHint = `\
Additional information may be available in debug mode. Prefix the command
line with DEBUG=1, i.e.:  DEBUG=1 balena ...
`;

export const getHelp = `${DEBUG_MODE ? '' : debugHint}\
If you need help, don't hesitate in contacting us at:

  Forums: https://forums.balena.io
  GitHub: https://github.com/balena-io/balena-cli/issues/new\
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
		password: '{escaped contents of the GCR keyfile.json file}'`;
