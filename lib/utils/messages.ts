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

export const deprecationPolicyNote = `\
The balena CLI enforces its deprecation policy by exiting with an error a year
after the release of the next major version, unless the --unsupported option is
used. Find out more at: https://git.io/JRHUW#deprecation-policy
`;

/**
 * Take a multiline string like:
 *     Line One
 *     Line Two
 * and return a string like:
 *     ---------------
 *     [Warn] Line One
 *     [Warn] Line Two
 *     ---------------
 * where the length of the dash rows matches the length of the longest line.
 */
export function warnify(msg: string, prefix = '[Warn] ') {
	let lines = msg.split('\n');
	lines = prefix ? lines.map((l) => `${prefix}${l}`) : lines;
	const maxLength = Math.max(...lines.map((l) => l.length));
	const hr = '-'.repeat(maxLength);
	return [hr, ...lines, hr].join('\n');
}

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
daemon or balenaEngine.  In a microservices (multicontainer) fleet, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) fleets that define a docker-compose.yml file. When this
option is used, each service subdirectory (defined by the \`build\` or
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

balena CLI v11 also took .gitignore files into account. This behavior was
deprecated in CLI v12 and removed in CLI v13. Please use .dockerignore files
instead.

Default .dockerignore patterns  \n` +
	`A few default/hardcoded dockerignore patterns are "merged" (in memory) with the
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
adding exception patterns to the applicable .dockerignore file(s), for example
\`!mysubmodule/.git\`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore`;

export const applicationIdInfo = `\
Fleets may be specified by fleet name, slug, or numeric ID. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the \`balena fleets\` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments). Numeric fleet IDs are deprecated because they consist of an
implementation detail of the balena backend. We intend to remove support for
numeric IDs at some point in the future.`;

export const applicationNameNote = `\
Fleets may be specified by fleet name or slug. Slugs are recommended because
they are unique and unambiguous. Slugs can be listed with the \`balena fleets\`
command. Note that slugs may change if the fleet is renamed. Fleet names are
not unique and may result in "Fleet is ambiguous" errors at any time (even if
"it used to work in the past"), for example if the name clashes with a newly
created public/open fleet, or with fleets from other balena accounts that you
may be invited to join under any role.  For this reason, fleet names are
especially discouraged in scripts (e.g. CI environments).`;

export const jsonInfo = `\
The --json option is recommended when scripting the output of this command,
because field names are less likely to change in JSON format and because it
better represents data types like arrays, empty strings and null values.
The 'jq' utility may be helpful for querying JSON fields in shell scripts
(https://stedolan.github.io/jq/manual/).`;

export const buildArgDeprecation = `\
WARNING: You have specified a '--buildArg' option, which is now deprecated, and
may be removed in the future.  The recommended alternative is build-time secrets:
https://www.balena.io/docs/learn/deploy/deployment/#build-time-secrets-and-variables

If you have a particular use for buildArg, which is not satisfied by build-time
secrets, please contact us via support or the forums: https://forums.balena.io/
\n`;

export const appToFleetFlagMsg = `\
Renaming notice: The '-a', '--app' or '--application' options are now
aliases for the '-f' or '--fleet' options. THE ALIASES WILL BE REMOVED
in the next major version of the balena CLI (so that a different '--app'
option can be implemented in the future). Use '-f' or '--fleet' instead.
Find out more at: https://git.io/JRuZr`;

export const appToFleetOutputMsg = `\
Renaming notice: The 'app' or 'application' words in table headers
or in JSON object keys/properties will be replaced with 'fleet' in
the next major version of the CLI (v13). The --v13 option may be used
to enable the new names already now, and suppress a warning message.
(The --v13 option will be silently ignored in CLI v13.)
Find out more at: https://git.io/JRuZr`;

export function getNodeEngineVersionWarn(
	version: string,
	validVersions: string,
) {
	version = version.startsWith('v') ? version.substring(1) : version;
	return warnify(`\
Node.js version "${version}" does not satisfy requirement "${validVersions}"
This may cause unexpected behavior.`);
}
