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

import { cleanOutput, runCommand } from '../helpers';
import * as messages from '../../build/utils/messages';

const SIMPLE_HELP = `
USAGE
$ balena [COMMAND] [OPTIONS]

PRIMARY COMMANDS
  login                                  login to balena
  push                                   start a remote build on the balenaCloud build servers or a local mode device
  app                                    display information about a single application
  device                                 show info about a single device
  preload                                preload an app on a disk image (or Edison zip archive)
  build                                  build a project locally
  deploy                                 deploy a single image or a multicontainer project to a balena application
  join                                   move a local device to an application on another balena server
  leave                                  remove a local device from its balena application

`;

const ADDITIONAL_HELP = `
ADDITIONAL COMMANDS
  api-key generate                       generate a new balenaCloud API key
  app create                             create an application
  app restart                            restart an application
  app rm                                 remove an application
  config generate                        generate a config.json file
  config inject                          inject a configuration file into a device or OS image
  config read                            read the configuration of a device or OS image
  config reconfigure                     interactively reconfigure a device or OS image
  config write                           write a key-value pair to configuration of a device or OS image
  device detect                          scan for balenaOS devices on your local network
  device identify                        identify a device
  device init                            initialise a device with balenaOS
  device list                            list all devices
  device logs                            show device logs
  device move                            move one or more devices to another application
  device os-update                       start a Host OS update for a device
  device public-url                      get or manage the public URL for a device
  device reboot                          restart a device
  device register                        register a device
  device rename                          rename a device
  device rm                              remove one or more devices
  device shutdown                        shutdown a device
  device ssh                             SSH into the host or application container of a device
  device tunnel                          tunnel local ports to your balenaOS device
  device-type list                       list the device types supported by balena (like 'raspberrypi3' or 'intel-nuc').
  env set                                add or update env or config variable to application(s), device(s) or service(s)
  env list                               list the environment or config variables of an application, device or service
  env rename                             change the value of a config or env var for an app, device or service
  env rm                                 remove a config or env var from an application, device or service
  ssh-key                                display an SSH key
  ssh-key add                            add an SSH key to balenaCloud
  ssh-key list                           list the SSH keys in balenaCloud
  ssh-key rm                             remove an SSH key from balenaCloud
  local configure                        (Re)configure a balenaOS drive or image
  local flash                            flash an image to a drive
  logout                                 logout from balena
  note                                   set a device note
  os configure                           configure a previously downloaded balenaOS image
  os download                            download an unconfigured OS image
  os initialize                          initialize an os image for a device
  os versions                            show available balenaOS versions for the given device type
  settings                               print current settings
  tag list                               list all tags for a app, block, fleet, device or release
  tag rm                                 remove a tag from an app, block, fleet, device or release
  tag set                                set a tag on an app, block, fleet, device or release
  util available-drives                  list available drives
  version                                display version information for the balena CLI and/or Node.js
  whoami                                 display account information for current user

`;

const LIST_ADDITIONAL = `
...MORE run balena help --verbose to list additional commands.
`;

const GLOBAL_OPTIONS = `
GLOBAL OPTIONS
  --help
  --debug

`;

const ONLINE_RESOURCES = messages.reachingOut;

describe.skip('balena help', function () {
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
