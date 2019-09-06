import * as chai from 'chai';
import * as _ from 'lodash';
import { runCommand } from '../helpers';

const SIMPLE_HELP = `
Usage: balena [COMMAND] [OPTIONS]

If you need help, or just want to say hi, don't hesitate in reaching out
through our discussion and support forums at https://forums.balena.io

For bug reports or feature requests, have a look at the GitHub issues or
create a new one at: https://github.com/balena-io/balena-cli/issues/

Primary commands:

    help [command...]                       show help
    login                                   login to balena
    push <applicationOrDevice>              Start a remote build on the balena cloud build servers or a local mode device
    logs <uuidOrDevice>                     show device logs
    ssh <applicationOrDevice> [serviceName] SSH into the host or application container of a device
    apps                                    list all applications
    app <name>                              list a single application
    devices                                 list all devices
    device <uuid>                           list a single device
    tunnel <deviceOrApplication>            Tunnel local ports to your balenaOS device
    preload <image>                         preload an app on a disk image (or Edison zip archive)
    build [source]                          Build a single image or a multicontainer project locally
    deploy <appName> [image]                Deploy a single image or a multicontainer project to a balena application
    join [deviceIp]                         Promote a local device running balenaOS to join an application on a balena server
    leave [deviceIp]                        Detach a local device from its balena application
    scan                                    Scan for balenaOS devices in your local network

`;

const ADDITIONAL_HELP = `
Additional commands:

    api-key generate <name>               Generate a new API key with the given name
    app create <name>                     create an application
    app restart <name>                    restart an application
    app rm <name>                         remove an application
    config generate                       generate a config.json file
    config inject <file>                  inject a device configuration file
    config read                           read a device configuration
    config reconfigure                    reconfigure a provisioned device
    config write <key> <value>            write a device configuration
    device identify <uuid>                identify a device with a UUID
    device init                           initialise a device with balenaOS
    device move <uuid>                    move a device to another application
    device os-update <uuid>               Start a Host OS update for a device
    device public-url <uuid>              gets the public URL of a device
    device public-url disable <uuid>      disable public URL for a device
    device public-url enable <uuid>       enable public URL for a device
    device public-url status <uuid>       Returns true if public URL is enabled for a device
    device reboot <uuid>                  restart a device
    device register <application>         register a device
    device rename <uuid> [newName]        rename a balena device
    device rm <uuid>                      remove a device
    device shutdown <uuid>                shutdown a device
    devices supported                     list all supported devices
    env add name [value]                  add an environment or config variable to an application or device
    env rename id value                   change the value of an environment variable for an app or device
    env rm id                             remove an environment variable from an application or device
    envs                                  list the environment or config variables of an app or device
    key <id>                              list a single ssh key
    key add <name> [path]                 add a SSH key to balena
    key rm <id>                           remove a ssh key
    keys                                  list all ssh keys
    local configure <target>              (Re)configure a balenaOS drive or image
    local flash <image>                   Flash an image to a drive
    logout                                logout from balena
    note <|note>                          set a device note
    os build-config <image> <device-type> build the OS config and save it to the JSON file
    os configure <image>                  configure an os image
    os download <type>                    download an unconfigured os image
    os initialize <image>                 initialize an os image
    os versions <type>                    show the available balenaOS versions for the given device type
    settings                              print current settings
    tag rm <tagKey>                       remove a resource tag
    tag set <tagKey> [value]              set a resource tag
    tags                                  list all resource tags
    util available-drives                 list available drives
    version                               display version information for the balena CLI and/or Node.js
    whoami                                get current username and email address

`;

const GLOBAL_OPTIONS = `
	Global Options:

		--help, -h
		--version, -v
`;

const cleanOutput = (output: string[] | string) => {
	return _(_.castArray(output))
		.map(log => {
			return log.split('\n').map(line => {
				return line.trim();
			});
		})
		.flatten()
		.compact()
		.value();
};

describe('balena help', function() {
	it('should print simple help text', async () => {
		const { out, err } = await runCommand('help');

		chai
			.expect(cleanOutput(out))
			.to.deep.equal(
				cleanOutput([
					SIMPLE_HELP,
					'Run `balena help --verbose` to list additional commands',
					GLOBAL_OPTIONS,
				]),
			);

		chai.expect(err.join('')).to.equal('');
	});

	it('should print additional commands with the -v flag', async () => {
		const { out, err } = await runCommand('help -v');

		chai
			.expect(cleanOutput(out))
			.to.deep.equal(
				cleanOutput([SIMPLE_HELP, ADDITIONAL_HELP, GLOBAL_OPTIONS]),
			);

		chai.expect(err.join('')).to.equal('');

		chai.expect(err.join('')).to.equal('');
	});
});
