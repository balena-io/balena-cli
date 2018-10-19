###
Copyright 2016-2017 Balena

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

   http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
###

# Loads '.balena-sync.yml' configuration from 'source' directory.
# Returns the configuration object on success
#

_ = require('lodash')

balenaPush = require('balena-sync').capitano('balena-toolbox')

# TODO: This is a temporary workaround to reuse the existing `rdt push`
# capitano frontend in `balena local push`.

balenaPushHelp = '''
	Warning: 'balena local push' requires an openssh-compatible client and 'rsync' to
	be correctly installed in your shell environment. For more information (including
	Windows support) please check the README here: https://github.com/balena-io/balena-cli

	Use this command to push your local changes to a container on a LAN-accessible balenaOS device on the fly.

	If `Dockerfile` or any file in the 'build-triggers' list is changed,
	a new container will be built and run on your device.
	If not, changes will simply be synced with `rsync` into the application container.

	After every 'balena local push' the updated settings will be saved in
	'<source>/.balena-sync.yml' and will be used in later invocations. You can
	also change any option by editing '.balena-sync.yml' directly.

	Here is an example '.balena-sync.yml' :

		$ cat $PWD/.balena-sync.yml
		local_balenaos:
			app-name: local-app
			build-triggers:
				- Dockerfile: file-hash-abcdefabcdefabcdefabcdefabcdefabcdef
				- package.json: file-hash-abcdefabcdefabcdefabcdefabcdefabcdef
			environment:
				- MY_VARIABLE=123


	Command line options have precedence over the ones saved in '.balena-sync.yml'.

	If '.gitignore' is found in the source directory then all explicitly listed files will be
	excluded when using rsync to update the container. You can choose to change this default behavior with the
	'--skip-gitignore' option.

	Examples:

		$ balena local push
		$ balena local push --app-name test-server --build-triggers package.json,requirements.txt
		$ balena local push --force-build
		$ balena local push --force-build --skip-logs
		$ balena local push --ignore lib/
		$ balena local push --verbose false
		$ balena local push 192.168.2.10 --source . --destination /usr/src/app
		$ balena local push 192.168.2.10 -s /home/user/balenaProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
'''


module.exports = _.assign balenaPush,
	signature: 'local push [deviceIp]'
	help: balenaPushHelp
	primary: true
	root: true
