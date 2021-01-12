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

export const reachingOut = `\
For further help or support, visit:
https://www.balena.io/docs/reference/balena-cli/#support-faq-and-troubleshooting
`;

const debugHint = `\
Additional information may be available with the \`--debug\` flag.
\n`;

export const help = reachingOut;

// Note that the value of process.env.DEBUG may change after the --debug flag
// is parsed, so its evaluation cannot happen at module loading time.
export const getHelp = () => (process.env.DEBUG ? '' : debugHint) + help;

export const balenaAsciiArt = `\
 _            _
| |__   __ _ | |  ____  _ __    __ _
| '_ \\ / _\` || | / __ \\| '_ \\  / _\` |
| |_) | (_) || ||  ___/| | | || (_) |
|_.__/ \\__,_||_| \\____/|_| |_| \\__,_|
`;

export const registrySecretsHelp =
	'REGISTRY SECRETS  \n' +
	`The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:
\`\`\`
	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'
\`\`\`
For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-examples/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.`;

export const dockerignoreHelp =
	'DOCKERIGNORE AND GITIGNORE FILES  \n' +
	`By default, the balena CLI will use a single ".dockerignore" file (if any) at
the project root (--source directory) in order to decide which source files to
exclude from the "build context" (tar stream) sent to balenaCloud, Docker
daemon or balenaEngine. In a microservices (multicontainer) application, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) applications that define a docker-compose.yml file. When
this option is used, each service subdirectory (defined by the \`build\` or
\`build.context\` service properties in the docker-compose.yml file) is
filtered separately according to a .dockerignore file defined in the service
subdirectory. If no .dockerignore file exists in a service subdirectory, then
only the default .dockerignore patterns (see below) apply for that service
subdirectory.

When the --multi-dockerignore (-m) option is used, the .dockerignore file (if
any) defined at the overall project root will be used to filter files and
subdirectories other than service subdirectories. It will not have any effect
on service subdirectories, whether or not a service subdirectory defines its
own .dockerignore file. Multiple .dockerignore files are not merged or added
together, and cannot override or extend other files. This behavior maximizes
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI releases older than v12.0.0 also took .gitignore files into account.
This behavior is deprecated, but may still be enabled with the --gitignore (-g)
option if compatibility is required. This option is mutually exclusive with
--multi-dockerignore (-m) and will be removed in the CLI's next major version
release (v13).

Default .dockerignore patterns  \n` +
	`When --gitignore (-g) is NOT used (i.e. when not in v11 compatibility mode), a
few default/hardcoded dockerignore patterns are "merged" (in memory) with the
patterns found in the applicable .dockerignore files, in the following order:
\`\`\`
    **/.git
    < user's patterns from the applicable '.dockerignore' file, if any >
    !**/.balena
    !**/.resin
    !**/Dockerfile
    !**/Dockerfile.*
    !**/docker-compose.yml
\`\`\`
These patterns always apply, whether or not .dockerignore files exist in the
project. If necessary, the effect of the \`**/.git\` pattern may be modified by
adding counter patterns to the applicable .dockerignore file(s), for example
\`!mysubmodule/.git\`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore`;

export const applicationIdInfo = `\
Applications may be specified by app name, slug, or numeric ID. App slugs
are the recommended option, as they are unique and unambiguous. Slugs
can be listed with the \`balena apps\` command. Note that slugs may change
if the application is renamed.
App names are not unique and may result in "Application is ambiguous" errors
at any time (even if it "used to work in the past"), for example if the name
clashes with a newly created public application, or with apps from other balena
accounts that you may have been invited to as a member. For this reason, app
names are especially discouraged in scripts (e.g. CI environments).
Numeric app IDs are deprecated because they consist of an implementation detail
of the balena backend. We intend to remove support for numeric IDs at some point
in the future.`;

export const jsonInfo = `\
The --json option is recommended when scripting the output of this command,
because field names are less likely to change in JSON format and because it
better represents data types like arrays, empty strings and null values.
The 'jq' utility may be helpful for querying JSON fields in shell scripts
(https://stedolan.github.io/jq/manual/).`;
