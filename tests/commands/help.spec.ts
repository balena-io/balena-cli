import { expect } from 'chai';
import { cleanOutput, runCommand } from '../helpers';

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
    app <name>                              display information about a single application
    devices                                 list all devices
    device <uuid>                           list a single device
    tunnel <deviceOrApplication>            Tunnel local ports to your balenaOS device
    preload <image>                         preload an app on a disk image (or Edison zip archive)
    build [source]                          Build a single image or a multicontainer project locally
    deploy <appName> [image]                Deploy a single image or a multicontainer project to a balena application
    join [deviceiporhostname]               move a local device to an application on another balena server
    leave [deviceiporhostname]              remove a local device from its balena application
    scan                                    scan for balenaOS devices on your local network

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
    local flash <image>                   Flash an image to a drive
    logout                                logout from balena
    note <|note>                          set a device note
    os build-config <image> <device-type> build the OS config and save it to the JSON file
    os configure <image>                  configure a previously downloaded balenaOS image
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

describe('balena help', function() {
	it('should list primary command summaries', async () => {
		const { out, err } = await runCommand('help');

		console.log('ONE');
		console.log(cleanOutput(out));
		console.log(
			cleanOutput([
				SIMPLE_HELP,
				'Run `balena help --verbose` to list additional commands',
				GLOBAL_OPTIONS,
			]),
		);
		console.log();

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([
				SIMPLE_HELP,
				'Run `balena help --verbose` to list additional commands',
				GLOBAL_OPTIONS,
			]),
		);

		expect(err.join('')).to.equal('');
	});

	it('should list all command summaries with the -v flag', async () => {
		const { out, err } = await runCommand('help -v');

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([SIMPLE_HELP, ADDITIONAL_HELP, GLOBAL_OPTIONS]),
		);

		expect(err.join('')).to.equal('');

		expect(err.join('')).to.equal('');
	});

	it('should list primary command summaries', async () => {
		const { out, err } = await runCommand('');

		expect(cleanOutput(out)).to.deep.equal(
			cleanOutput([
				SIMPLE_HELP,
				'Run `balena help --verbose` to list additional commands',
				GLOBAL_OPTIONS,
			]),
		);

		expect(err.join('')).to.equal('');
	});
});
