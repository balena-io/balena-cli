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

import { BalenaAPIMock } from '../balena-api-mock';
import { cleanOutput, runCommand } from '../helpers';

const SIMPLE_HELP = `
Usage: balena [COMMAND] [OPTIONS]

Primary commands:

    help [command...]                       show help
    login                                   login to balena
    push <applicationOrDevice>              Start a remote build on the balena cloud build servers or a local mode device
    logs <device>                           show device logs
    ssh <applicationordevice> [servicename] SSH into the host or application container of a device
    apps                                    list all applications
    app <name>                              display information about a single application
    devices                                 list all devices
    device <uuid>                           show info about a single device
    tunnel <deviceorapplication>            tunnel local ports to your balenaOS device
    preload <image>                         preload an app on a disk image (or Edison zip archive)
    build [source]                          Build a single image or a multicontainer project locally
    deploy <appName> [image]                Deploy a single image or a multicontainer project to a balena application
    join [deviceiporhostname]               move a local device to an application on another balena server
    leave [deviceiporhostname]              remove a local device from its balena application
    scan                                    scan for balenaOS devices on your local network

`;

const ADDITIONAL_HELP = `
Additional commands:

    api-key generate <name>               generate a new balenaCloud API key
    app create <name>                     create an application
    app restart <name>                    restart an application
    app rm <name>                         remove an application
    config generate                       generate a config.json file
    config inject <file>                  inject a device configuration file
    config read                           read a device configuration
    config reconfigure                    reconfigure a provisioned device
    config write <key> <value>            write a device configuration
    device identify <uuid>                identify a device
    device init                           initialise a device with balenaOS
    device move <uuid(s)>                 move one or more devices to another application
    device os-update <uuid>               start a Host OS update for a device
	device public-url <uuid>              get or manage the public URL for a device
    device reboot <uuid>                  restart a device
    device register <application>         register a device
    device rename <uuid> [newname]        rename a device
    device rm <uuid>                      remove a device
    device shutdown <uuid>                shutdown a device
    devices supported                     list the supported device types (like 'raspberrypi3' or 'intel-nuc')
    env add <name> [value]                add an environment or config variable to an application, device or service
    env rename <id> <value>               change the value of a config or env var for an app, device or service
    env rm <id>                           remove a config or env var from an application, device or service
    envs                                  list the environment or config variables of an application, device or service
    key <id>                              display an SSH key
    key add <name> [path]                 add an SSH key to balenaCloud
    key rm <id>                           remove an SSH key from balenaCloud
    keys                                  list the SSH keys in balenaCloud
    local configure <target>              (Re)configure a balenaOS drive or image
    local flash <image>                   flash an image to a drive
    logout                                logout from balena
    note <|note>                          set a device note
    os build-config <image> <device-type> build the OS config and save it to the JSON file
    os configure <image>                  configure a previously downloaded balenaOS image
    os download <type>                    download an unconfigured OS image
    os initialize <image>                 initialize an os image for a device
    os versions <type>                    show available balenaOS versions for the given device type
    settings                              print current settings
    tag rm <tagkey>                       remove a tag from an application, device or release
    tag set <tagkey> [value]              set a tag on an application, device or release
    tags                                  list all tags for an application, device or release
    util available-drives                 list available drives
    version                               display version information for the balena CLI and/or Node.js
    whoami                                get current username and email address

`;

const LIST_ADDITIONAL = `
Run \`balena help --verbose\` to list additional commands
`;

const GLOBAL_OPTIONS = `
	Global Options:

		--help, -h
		--version, -v
		--debug
`;

const ONLINE_RESOURCES = `
      For help, visit our support forums: https://forums.balena.io
      For bug reports or feature requests, see: https://github.com/balena-io/balena-cli/issues/
`;

describe('balena help', function () {
	let api: BalenaAPIMock;

	this.beforeEach(() => {
		api = new BalenaAPIMock();
		api.expectGetMixpanel({ optional: true });
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
