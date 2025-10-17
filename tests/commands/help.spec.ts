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
  login    login to balena
  push     build release images on balenaCloud servers or on a local mode device
  fleet    display information about a single fleet
  device   show info about a single device
  preload  preload a release on a disk image (or Edison zip archive)
  build    build a project locally
  deploy   deploy a single image or a multicontainer project to a balena fleet
  join     move a local device to a fleet on another balena server
  leave    remove a local device from its balena fleet

`;

const SIMPLE_HELP_VERBOSE = `
USAGE
$ balena [COMMAND] [OPTIONS]

PRIMARY COMMANDS
  login                   login to balena
  push                    build release images on balenaCloud servers or on a
  local mode device
  fleet                   display information about a single fleet
  device                  show info about a single device
  preload                 preload a release on a disk image (or Edison zip
  archive)
  build                   build a project locally
  deploy                  deploy a single image or a multicontainer project to a
  balena fleet
  join                    move a local device to a fleet on another balena
  server
  leave                   remove a local device from its balena fleet

`;

const ADDITIONAL_HELP = `
ADDITIONAL COMMANDS
  api-key generate        generate a new balenaCloud API key
  api-key list            print a list of balenaCloud API keys
  api-keys                print a list of balenaCloud API keys
  api-key revoke          revoke balenaCloud API keys
  app create              create an app
  block create            create an block
  config generate         generate a config.json file
  config inject           inject a config.json file to a balenaOS image or
  attached media
  config read             read the config.json file of a balenaOS image or
  attached media
  config reconfigure      interactively reconfigure a balenaOS image file or
  attached media
  config write            write a key-value pair to the config.json file of an
  OS image or attached media
  device-type list        list the device types supported by balena (like
  'raspberrypi3' or 'intel-nuc')
  devices supported       list the device types supported by balena (like
  'raspberrypi3' or 'intel-nuc')
  device deactivate       deactivate a device
  device detect           scan for balenaOS devices on your local network
  scan                    scan for balenaOS devices on your local network
  device identify         identify a device
  device init             initialize a device with balenaOS
  device list             list all devices
  devices                 list all devices
  device local-mode       get or manage the local mode status for a device
  device logs             show device logs
  logs                    show device logs
  device move             move one or more devices to another fleet
  device note             set a device note
  notes                   set a device note
  device os-update        start a Host OS update for a device
  device pin              pin a device to a release
  device public-url       get or manage the public URL for a device
  device purge            purge data from a device
  device reboot           restart a device
  device register         register a new device
  device rename           rename a device
  device restart          restart containers on a device
  device rm               remove one or more devices
  device shutdown         shutdown a device
  device ssh              open a SSH prompt on a device's host OS or service
  container
  ssh                     open a SSH prompt on a device's host OS or service
  container
  device start-service    start containers on a device
  device stop-service     stop containers on a device
  device track-fleet      make a device track the fleet's pinned release
  device tunnel           tunnel local ports to your balenaOS device
  tunnel                  tunnel local ports to your balenaOS device
  env list                list the environment or config variables of a fleet,
  device or service
  envs                    list the environment or config variables of a fleet,
  device or service
  env rename              change the value of a config or env var for a fleet,
  device or service
  env rm                  remove a config or env var from a fleet, device or
  service
  env set                 add or update env or config variable to fleets,
  devices or services
  env add                 add or update env or config variable to fleets,
  devices or services
  fleet create            create a fleet
  fleet list              list all fleets
  fleets                  list all fleets
  fleet pin               pin a fleet to a release
  fleet purge             purge data from a fleet
  fleet rename            rename a fleet
  fleet restart           restart a fleet
  fleet rm                remove a fleet
  fleet track-latest      make this fleet track the latest release
  local configure         (Re)configure a balenaOS drive or image
  local flash             flash an image to a drive
  logout                  logout from balena
  organization list       list all organizations
  orgs                    list all organizations
  os build-config         prepare a configuration file for use by the 'os
  configure' command
  os configure            configure a previously downloaded balenaOS image
  os download             download an unconfigured OS image
  os initialize           initialize an os image for a device
  os versions             show available balenaOS versions for the given device
  type
  release                 get info for a release
  release-asset delete    delete a release asset
  release-asset download  download a release asset
  release-asset list      list all release assets
  release-asset upload    upload a release asset
  release finalize        finalize a release
  release invalidate      invalidate a release
  release list            list all releases of a fleet
  releases                list all releases of a fleet
  release validate        validate a release
  settings                print current settings
  ssh-key                 display an SSH key
  key                     display an SSH key
  ssh-key add             add an SSH key to balenaCloud
  key add                 add an SSH key to balenaCloud
  ssh-key list            list the SSH keys in balenaCloud
  keys                    list the SSH keys in balenaCloud
  key list                list the SSH keys in balenaCloud
  ssh-key rm              remove an SSH key from balenaCloud
  key rm                  remove an SSH key from balenaCloud
  support                 grant or revoke support access for devices or fleets
  tag list                list all tags for a fleet, device or release
  tags                    list all tags for a fleet, device or release
  tag rm                  remove a tag from a fleet, device or release
  tag set                 set a tag on a fleet, device or release
  util available-drives   list available drives
  version                 display version information for the balena CLI and/or
  Node.js
  whoami                  display account information for current user

`;

const LIST_ADDITIONAL = `
...MORE run balena help --verbose to list additional commands.
`;

const GLOBAL_OPTIONS = `
GLOBAL OPTIONS
  --help         display command help
  --debug        enable debug output
  --unsupported  prevent exit with an error as per Deprecation Policy
  See: https://git.io/JRHUW#deprecation-policy

Deprecation Policy Reminder
The balena CLI enforces its deprecation policy by exiting with an error a year
after the release of the next major version, unless the --unsupported option is
used. Find out more at: https://git.io/JRHUW#deprecation-policy

`;

const GLOBAL_OPTIONS_VERBOSE = `
GLOBAL OPTIONS
  --help                  display command help
  --debug                 enable debug output
  --unsupported           prevent exit with an error as per Deprecation Policy
  See: https://git.io/JRHUW#deprecation-policy

Deprecation Policy Reminder
The balena CLI enforces its deprecation policy by exiting with an error a year
after the release of the next major version, unless the --unsupported option is
used. Find out more at: https://git.io/JRHUW#deprecation-policy

`;

const ONLINE_RESOURCES = messages.reachingOut;

describe('balena help', function () {
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
				SIMPLE_HELP_VERBOSE,
				ADDITIONAL_HELP,
				GLOBAL_OPTIONS_VERBOSE,
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
