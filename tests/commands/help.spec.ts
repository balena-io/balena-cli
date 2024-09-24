/**
 * @license
 * Copyright 2019-2020 Balena Ltd.
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

import { expect } from 'chai';

import { BalenaAPIMock } from '../nock/balena-api-mock';
import { cleanOutput, runCommand } from '../helpers';
import * as messages from '../../build/utils/messages';

const SIMPLE_HELP = `
USAGE
$ balena [COMMAND] [OPTIONS]

PRIMARY COMMANDS
  login                                  login to balena
  push <applicationOrDevice>             start a remote build on the balenaCloud build servers or a local mode device
  logs <device>                          show device logs
  ssh <applicationOrDevice> [service]    SSH into the host or application container of a device
  apps                                   list all applications
  app <name>                             display information about a single application
  device <uuid>                          show info about a single device
  tunnel <deviceOrApplication>           tunnel local ports to your balenaOS device
  preload <image>                        preload an app on a disk image (or Edison zip archive)
  build [source]                         build a project locally
  deploy <appName> [image]               deploy a single image or a multicontainer project to a balena application
  join [deviceIpOrHostname]              move a local device to an application on another balena server
  leave [deviceIpOrHostname]             remove a local device from its balena application
  scan                                   scan for balenaOS devices on your local network

`;

const ADDITIONAL_HELP = `
ADDITIONAL COMMANDS
  api-key generate <name>                generate a new balenaCloud API key
  app create <name>                      create an application
  app restart <name>                     restart an application
  app rm <name>                          remove an application
  config generate                        generate a config.json file
  config inject <file>                   inject a configuration file into a device or OS image
  config read                            read the configuration of a device or OS image
  config reconfigure                     interactively reconfigure a device or OS image
  config write <key> <value>             write a key-value pair to configuration of a device or OS image
  device identify <uuid>                 identify a device
  device init                            initialise a device with balenaOS
  device list                            list all devices
  device move <uuid(s)>                  move one or more devices to another application
  device os-update <uuid>                start a Host OS update for a device
  device public-url <uuid>               get or manage the public URL for a device
  device reboot <uuid>                   restart a device
  device register <application>          register a device
  device rename <uuid> [newName]         rename a device
  device rm <uuid(s)>                    remove one or more devices
  device shutdown <uuid>                 shutdown a device
  devices supported                      list the supported device types (like 'raspberrypi3' or 'intel-nuc')
  env add <name> [value]                 add env or config variable to application(s), device(s) or service(s)
  env list                               list the environment or config variables of an application, device or service
  env rename <name> <value>              change the value of a config or env var for an app, device or service
  env rm <id>                            remove a config or env var from an application, device or service
  ssh-key <id>                           display an SSH key
  ssh-key add <name> [path]              add an SSH key to balenaCloud
  ssh-key list                           list the SSH keys in balenaCloud
  ssh-key rm <id>                        remove an SSH key from balenaCloud
  local configure <target>               (Re)configure a balenaOS drive or image
  local flash <image>                    flash an image to a drive
  logout                                 logout from balena
  note <|note>                           set a device note
  os build-config <image> <device-type>  build an OS config and save it to a JSON file
  os configure <image>                   configure a previously downloaded balenaOS image
  os download <type>                     download an unconfigured OS image
  os initialize <image>                  initialize an os image for a device
  os versions <type>                     show available balenaOS versions for the given device type
  settings                               print current settings
  tag rm <tagKey>                        remove a tag from an application, device or release
  tag set <tagKey> [value]               set a tag on an application, device or release
  tags                                   list all tags for an application, device or release
  util available-drives                  list available drives
  version                                display version information for the balena CLI and/or Node.js
  whoami                                 display account information for current user

`;

const LIST_ADDITIONAL = `
...MORE run balena help --verbose to list additional commands.
`;

const GLOBAL_OPTIONS = `
GLOBAL OPTIONS
  --help, -h
  --debug

`;

const ONLINE_RESOURCES = messages.reachingOut;

describe.skip('balena help', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
	});

	this.afterEach(() => {
		// Check all expected api calls have been made and clean up.
		api.done();
	});

	it('should list primary command summaries', async () => {
		const { out, err } = await runCommand('help');

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([
				SIMPLE_HELP,
				LIST_ADDITIONAL,
				GLOBAL_OPTIONS,
				ONLINE_RESOURCES,
			]),
		);

		expect(err.join('')).to.equal('');
	});

	it('should list all command summaries with the -v flag', async () => {
		const { out, err } = await runCommand('help -v');

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([
				SIMPLE_HELP,
				ADDITIONAL_HELP,
				GLOBAL_OPTIONS,
				ONLINE_RESOURCES,
			]),
		);

		expect(err.join('')).to.equal('');

		expect(err.join('')).to.equal('');
	});

	it('should list primary command summaries', async () => {
		const { out, err } = await runCommand('');

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([
				SIMPLE_HELP,
				LIST_ADDITIONAL,
				GLOBAL_OPTIONS,
				ONLINE_RESOURCES,
			]),
		);

		expect(err.join('')).to.equal('');
	});
});
