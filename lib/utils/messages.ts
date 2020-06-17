/**
 * @license
 * Copyright 2017-2020 Balena Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const DEBUG_MODE = !!process.env.DEBUG;

export const reachingOut = `\
If you need help, or just want to say hi, don't hesitate in reaching out
through our discussion and support forums at https://forums.balena.io

For bug reports or feature requests, have a look at the GitHub issues or
create a new one at: https://github.com/balena-io/balena-cli/issues/\
`;

const debugHint = `\
Additional information may be available with the \`--debug\` flag.
`;

export const help = `\
For help, visit our support forums: https://forums.balena.io
For bug reports or feature requests, see: https://github.com/balena-io/balena-cli/issues/
`;

export const getHelp = (DEBUG_MODE ? '' : debugHint) + help;

export const balenaAsciiArt = `\
 _            _
| |__   __ _ | |  ____  _ __    __ _
| '_ \\ / _\` || | / __ \\| '_ \\  / _\` |
| |_) | (_) || ||  ___/| | | || (_) |
|_.__/ \\__,_||_| \\____/|_| |_| \\__,_|
`;

export const registrySecretsHelp = `\
REGISTRY SECRETS
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

For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-playground/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.`;

export const dockerignoreHelp = `\
DOCKERIGNORE AND GITIGNORE FILES
The balena CLI will use a '.dockerignore' file (if any) at the source directory
in order to decide which source files to exclude from the "build context" sent
to balenaCloud, Docker or balenaEngine. In a microservices / multicontainer
application, the source directory is usually where the 'docker-compose.yml'
file is located, and therefore the '.dockerignore' file should be located
alongside the 'docker-compose.yml' file. Matching patterns may be prefixed with
the service's directory name (relative to the source directory) in order to
apply to that service only (e.g. 'service1/node_modules').

Previous balena CLI releases (before v12.0.0) also took '.gitignore' files
into account. This behavior is deprecated, but may still be enabled with the
--gitignore (-g) option if compatibility is required. This option will be
removed in the CLI's next major version release (v13).

When --gitignore (-g) is NOT provided (i.e. when not in v11 compatibility mode),
a few "hardcoded" dockerignore patterns are also used and "merged" (in memory)
with the patterns found in the '.dockerignore' file (if any), in the following
order:

    **/.git
    < user's patterns from the '.dockerignore' file, if any >
    !**/.balena
    !**/.resin
    !**/Dockerfile
    !**/Dockerfile.*
    !**/docker-compose.yml

If necessary, the effect of the '**/.git' pattern may be modified by adding
"counter patterns" to the '.dockerignore' file, for example '!service1/.git'.
For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore`;
