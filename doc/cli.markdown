# Resin CLI Documentation

This tool allows you to interact with the resin.io api from the comfort of your command line.

To get started download the CLI from npm.

	$ npm install resin-cli -g

Then authenticate yourself:

	$ resin login

Now you have access to all the commands referenced below.

# Table of contents

- Application

	- app create <name>
	- apps
	- app <name>
	- app restart <name>
	- app rm <name>
	- app associate <name>
	- init

- Authentication

	- whoami
	- login [token]
	- logout
	- signup

- Device

	- devices
	- device <name>
	- device rm <name>
	- device identify <uuid>
	- device rename <name> [newName]
	- devices supported
	- device init [device]

- Drive

	- drives

- Environment Variables

	- envs
	- env rm <id>
	- env add <key> [value]
	- env rename <id> <value>

- Examples

	- examples
	- example <id>
	- example clone <id>

- Help

	- help [command...]

- Information

	- version

- Keys

	- keys
	- key <id>
	- key rm <id>
	- key add <name> [path]

- Logs

	- logs <uuid>

- Notes

	- note <|note>

- OS

	- os download <id>
	- os install <image> [device]

- Plugin

	- plugins
	- plugin install <name>
	- plugin update <name>
	- plugin rm <name>

- Preferences

	- preferences

- Update

	- update

# Application
## app create &#60;name&#62;

Use this command to create a new resin.io application.

You can specify the application type with the `--type` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ resin devices supported

Examples:

	$ resin app create MyApp
	$ resin app create MyApp --type raspberry-pi

### Options

#### --type, -t &#60;type&#62;

application type

## apps

Use this command to list all your applications.

Notice this command only shows the most important bits of information for each app.
If you want detailed information, use resin app <name> instead.

Examples:

	$ resin apps

## app &#60;name&#62;

Use this command to show detailed information for a single application.

Examples:

	$ resin app MyApp

## app restart &#60;name&#62;

Use this command to restart all devices that belongs to a certain application.

Examples:

	$ resin app restart MyApp

## app rm &#60;name&#62;

Use this command to remove a resin.io application.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin app rm MyApp
	$ resin app rm MyApp --yes

### Options

#### --yes, -y

confirm non interactively

## app associate &#60;name&#62;

Use this command to associate a project directory with a resin application.

This command adds a 'resin' git remote to the directory and runs git init if necessary.

Examples:

	$ resin app associate MyApp
	$ resin app associate MyApp --project my/app/directory

## init

Use this command to initialise a directory as a resin application.

This command performs the following steps:
	- Create a resin.io application.
	- Initialize the current directory as a git repository.
	- Add the corresponding git remote to the application.

Examples:

	$ resin init
	$ resin init --project my/app/directory

# Authentication
## whoami

Use this command to find out the current logged in username.

Examples:

	$ resin whoami

## login [token]

Use this command to login to your resin.io account.

To login, you need your token, which is accesible from the preferences page:

	https://staging.resin.io/preferences

Examples:

	$ resin login
	$ resin login "eyJ0eXAiOiJKV1Qi..."

## logout

Use this command to logout from your resin.io account.o

Examples:

	$ resin logout

## signup

Use this command to signup for a resin.io account.

If signup is successful, you'll be logged in to your new user automatically.

Examples:

	$ resin signup
	Email: me@mycompany.com
	Username: johndoe
	Password: ***********

	$ resin signup --email me@mycompany.com --username johndoe --password ***********

	$ resin whoami
	johndoe

### Options

#### --email, -e &#60;email&#62;

user email

#### --username, -u &#60;username&#62;

user name

#### --password, -p &#60;user password&#62;

user password

# Device
## devices

Use this command to list all devices that belong to a certain application.

Examples:

	$ resin devices --application MyApp

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

## device &#60;name&#62;

Use this command to show information about a single device.

Examples:

	$ resin device MyDevice

## device rm &#60;name&#62;

Use this command to remove a device from resin.io.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin device rm MyDevice
	$ resin device rm MyDevice --yes

### Options

#### --yes, -y

confirm non interactively

## device identify &#60;uuid&#62;

Use this command to identify a device.

In the Raspberry Pi, the ACT led is blinked several times.

Examples:

	$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828

## device rename &#60;name&#62; [newName]

Use this command to rename a device.

If you omit the name, you'll get asked for it interactively.

Examples:

	$ resin device rename MyDevice MyPi
	$ resin device rename MyDevice

## devices supported

Use this command to get the list of all supported devices

Examples:

	$ resin devices supported

## device init [device]

Use this command to download the OS image of a certain application and write it to an SD Card.

Note that this command requires admin privileges.

If `device` is omitted, you will be prompted to select a device interactively.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

You can quiet the progress bar by passing the `--quiet` boolean option.

You may have to unmount the device before attempting this operation.

You need to configure the network type and other settings:

Ethernet:
  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
  You can setup the device OS to use wifi by setting the `--network` option to "wifi".
  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

You can omit network related options to be asked about them interactively.

Examples:

	$ resin device init
	$ resin device init --application 91
	$ resin device init --application 91 --network ethernet
	$ resin device init /dev/disk2 --application 91 --network wifi --ssid MyNetwork --key secret

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --network, -n &#60;network&#62;

network type

#### --ssid, -s &#60;ssid&#62;

wifi ssid, if network is wifi

#### --key, -k &#60;key&#62;

wifi key, if network is wifi

# Drive
## drives

Use this command to list all drives that are connected to your machine.

Examples:

	$ resin drives

# Environment Variables
## envs

Use this command to list all environment variables for a particular application.
Notice we will support per-device environment variables soon.

This command lists all custom environment variables set on the devices running
the application. If you want to see all environment variables, including private
ones used by resin, use the verbose option.

Example:

	$ resin envs --application 91
	$ resin envs --application 91 --verbose

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --verbose, -v

show private environment variables

## env rm &#60;id&#62;

Use this command to remove an environment variable from an application.

Don't remove resin specific variables, as things might not work as expected.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin env rm 215
	$ resin env rm 215 --yes

### Options

#### --yes, -y

confirm non interactively

## env add &#60;key&#62; [value]

Use this command to add an enviroment variable to an application.

You need to pass the `--application` option.

If value is omitted, the tool will attempt to use the variable's value
as defined in your host machine.

If the value is grabbed from the environment, a warning message will be printed.
Use `--quiet` to remove it.

Examples:

	$ resin env add EDITOR vim -a 91
	$ resin env add TERM -a 91

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

## env rename &#60;id&#62; &#60;value&#62;

Use this command to rename an enviroment variable from an application.

Examples:

	$ resin env rename 376 emacs

# Examples
## examples

Use this command to list available example applications from resin.io

Example:

	$ resin examples

## example &#60;id&#62;

Use this command to show information of a single example application

Example:

	$ resin example 3

## example clone &#60;id&#62;

Use this command to clone an example application to the current directory

This command outputs information about the cloning process.
Use `--quiet` to remove that output.

Example:

	$ resin example clone 3

# Help
## help [command...]

Get detailed help for an specific command.

Examples:

	$ resin help apps
	$ resin help os download

# Information
## version

Display the Resin CLI version.

# Keys
## keys

Use this command to list all your SSH keys.

Examples:

	$ resin keys

## key &#60;id&#62;

Use this command to show information about a single SSH key.

Examples:

	$ resin key 17

## key rm &#60;id&#62;

Use this command to remove a SSH key from resin.io.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin key rm 17
	$ resin key rm 17 --yes

### Options

#### --yes, -y

confirm non interactively

## key add &#60;name&#62; [path]

Use this command to associate a new SSH key with your account.

If `path` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ resin key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | resin key add Main

# Logs
## logs &#60;uuid&#62;

Use this command to show logs for a specific device.

By default, the command prints all log messages and exit.

To limit the output to the n last lines, use the `--num` option along with a number.
This is similar to doing `resin logs <uuid> | tail -n X`.

To continuously stream output, and see new logs in real time, use the `--tail` option.

Note that for now you need to provide the whole UUID for this command to work correctly,
and the tool won't notice if you're using an invalid UUID.

This is due to some technical limitations that we plan to address soon.

Examples:

	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --num 20
	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail

### Options

#### --num, -n &#60;num&#62;

number of lines to display

#### --tail, -t

continuously stream output

# Notes
## note &#60;|note&#62;

Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from `stdin`.

To view the notes, use $ resin device <name>.

Examples:

	$ resin note "My useful note" --device MyDevice
	$ cat note.txt | resin note --device MyDevice

### Options

#### --device, --d,dev, --d,dev &#60;device&#62;

device name

# OS
## os download &#60;id&#62;

Use this command to download the device OS configured to a specific network.

Ethernet:
	You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
	You can setup the device OS to use wifi by setting the `--network` option to "wifi".
	If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

Alternatively, you can omit all kind of network configuration options to configure interactively.

You have to specify an output location with the `--output` option.

Examples:

	$ resin os download 91 --output ~/MyResinOS.zip
	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip
	$ resin os download 91 --network wifi --ssid MyNetwork --key secreykey123 --output ~/MyResinOS.zip
	$ resin os download 91 --network ethernet --output ~/MyResinOS.zip

### Options

#### --network, -n &#60;network&#62;

network type

#### --ssid, -s &#60;ssid&#62;

wifi ssid, if network is wifi

#### --key, -k &#60;key&#62;

wifi key, if network is wifi

#### --output, -o &#60;output&#62;

output file

## os install &#60;image&#62; [device]

Use this command to write an operating system image to a device.

Note that this command requires admin privileges.

If `device` is omitted, you will be prompted to select a device interactively.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

You can quiet the progress bar by passing the `--quiet` boolean option.

You may have to unmount the device before attempting this operation.

See the `drives` command to get a list of all connected devices to your machine and their respective ids.

In Mac OS X:

	$ sudo diskutil unmountDisk /dev/xxx

In GNU/Linux:

	$ sudo umount /dev/xxx

Examples:

	$ resin os install rpi.iso /dev/disk2

### Options

#### --yes, -y

confirm non interactively

# Plugin
## plugins

Use this command to list all the installed resin plugins.

Examples:

	$ resin plugins

## plugin install &#60;name&#62;

Use this command to install a resin plugin

Use `--quiet` to prevent information logging.

Examples:

	$ resin plugin install hello

## plugin update &#60;name&#62;

Use this command to update a resin plugin

Use `--quiet` to prevent information logging.

Examples:

	$ resin plugin update hello

## plugin rm &#60;name&#62;

Use this command to remove a resin.io plugin.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin plugin rm hello
	$ resin plugin rm hello --yes

### Options

#### --yes, -y

confirm non interactively

# Preferences
## preferences

Use this command to open the preferences form.

In the future, we will allow changing all preferences directly from the terminal.
For now, we open your default web browser and point it to the web based preferences form.

Examples:

	$ resin preferences

# Update
## update

Use this command to update the Resin CLI

This command outputs information about the update process.
Use `--quiet` to remove that output.

The Resin CLI checks for updates once per day.

Major updates require a manual update with this update command,
while minor updates are applied automatically.

Examples:

	$ resin update

