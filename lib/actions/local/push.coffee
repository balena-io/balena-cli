###
Copyright 2016 Resin.io

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

# Loads '.resin-sync.yml' configuration from 'source' directory.
# Returns the configuration object on success
#

resinPush = require('resin-sync').capitano('resin-toolbox')

# TODO: This is a temporary workaround to reuse the existing `rdt push`
# capitano frontend in `resin local push`.
resinPush.signature = 'local push [deviceIp]'
resinPush.help =
	help: '''
		Warning: 'resin local push' requires an openssh-compatible client and 'rsync' to
		be correctly installed in your shell environment. For more information (including
		Windows support) please check the README here: https://github.com/resin-io/resin-cli

		Use this command to push your local changes to a container on a LAN-accessible resinOS device on the fly.

		If `Dockerfile` or any file in the 'build-triggers' list is changed, a new container will be built and run on your device.
		If not, changes will simply be synced with `rsync` into the application container.

		After every 'resin local push' the updated settings will be saved in
		'<source>/.resin-sync.yml' and will be used in later invocations. You can
		also change any option by editing '.resin-sync.yml' directly.

		Here is an example '.resin-sync.yml' :

			$ cat $PWD/.resin-sync.yml
			destination: '/usr/src/app'
			before: 'echo Hello'
			after: 'echo Done'
			ignore:
				- .git
				- node_modules/

		Command line options have precedence over the ones saved in '.resin-sync.yml'.

		If '.gitignore' is found in the source directory then all explicitly listed files will be
		excluded when using rsync to update the container. You can choose to change this default behavior with the
		'--skip-gitignore' option.

		Examples:

			$ resin local push
			$ resin local push --app-name test-server --build-triggers package.json,requirements.txt
			$ resin local push --force-build
			$ resin local push --force-build --skip-logs
			$ resin local push --ignore lib/
			$ resin local push --verbose false
			$ resin local push 192.168.2.10 --source . --destination /usr/src/app
			$ resin local push 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	'''
resinPush.primary = true
resinPush.root = true
module.exports = resinPush
