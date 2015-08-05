# Resin CLI Documentation

This tool allows you to interact with the resin.io api from the comfort of your command line.

To get started download the CLI from npm.

	$ npm install resin-cli -g

Then authenticate yourself:

	$ resin login

Now you have access to all the commands referenced below.

# Table of contents

- Application

	- [app create &#60;name&#62;](#app-create-60-name-62-)
	- [apps](#apps)
	- [app &#60;name&#62;](#app-60-name-62-)
	- [app restart &#60;name&#62;](#app-restart-60-name-62-)
	- [app rm &#60;name&#62;](#app-rm-60-name-62-)
	- [app associate &#60;name&#62;](#app-associate-60-name-62-)
	- [init](#init)

- Authentication

	- [login [token]](#login-token-)
	- [logout](#logout)
	- [signup](#signup)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [device &#60;uuid&#62;](#device-60-uuid-62-)
	- [device rm &#60;uuid&#62;](#device-rm-60-uuid-62-)
	- [device identify &#60;uuid&#62;](#device-identify-60-uuid-62-)
	- [device rename &#60;uuid&#62; [newName]](#device-rename-60-uuid-62-newname-)
	- [devices supported](#devices-supported)
	- [device await &#60;uuid&#62;](#device-await-60-uuid-62-)
	- [device init [device]](#device-init-device-)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-60-id-62-)
	- [env add &#60;key&#62; [value]](#env-add-60-key-62-value-)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-60-id-62-60-value-62-)

- Help

	- [help [command...]](#help-command-)

- Information

	- [version](#version)
	- [config](#config)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-60-id-62-)
	- [key rm &#60;id&#62;](#key-rm-60-id-62-)
	- [key add &#60;name&#62; [path]](#key-add-60-name-62-path-)

- Logs

	- [logs &#60;uuid&#62;](#logs-60-uuid-62-)

- Notes

	- [note &#60;|note&#62;](#note-60-note-62-)

- Plugin

	- [plugins](#plugins)
	- [plugin install &#60;name&#62;](#plugin-install-60-name-62-)
	- [plugin update &#60;name&#62;](#plugin-update-60-name-62-)
	- [plugin rm &#60;name&#62;](#plugin-rm-60-name-62-)

- Preferences

	- [preferences](#preferences)

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

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin app associate MyApp
	$ resin app associate MyApp --project my/app/directory

### Options

#### --yes, -y

confirm non interactively

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

## login [token]

Use this command to login to your resin.io account.

To login, you need your token, which is accesible from the preferences page:

	https://dashboard.resin.io/preferences

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

## whoami

Use this command to find out the current logged in username.

Examples:

	$ resin whoami

# Device

## devices

Use this command to list all devices that belong to you.

You can filter the devices by application by using the `--application` option.

Examples:

	$ resin devices
	$ resin devices --application MyApp
	$ resin devices --app MyApp
	$ resin devices -a MyApp

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

## device &#60;uuid&#62;

Use this command to show information about a single device.

Examples:

	$ resin device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

## device rm &#60;uuid&#62;

Use this command to remove a device from resin.io.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	$ resin device rm 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --yes

### Options

#### --yes, -y

confirm non interactively

## device identify &#60;uuid&#62;

Use this command to identify a device.

In the Raspberry Pi, the ACT led is blinked several times.

Examples:

	$ resin device identify 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828

## device rename &#60;uuid&#62; [newName]

Use this command to rename a device.

If you omit the name, you'll get asked for it interactively.

Examples:

	$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 MyPi
	$ resin device rename 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

## devices supported

Use this command to get the list of all supported devices

Examples:

	$ resin devices supported

## device await &#60;uuid&#62;

Use this command to await for a device to become online.

The process will exit when the device becomes online.

Notice that there is no time limit for this command, so it might run forever.

You can configure the poll interval with the --interval option (defaults to 3000ms).

Examples:

	$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	$ resin device await 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9 --interval 1000

### Options

#### --interval, -i &#60;interval&#62;

poll interval

## device init [device]

Use this command to download the OS image of a certain application and write it to an SD Card.

Note that this command requires admin privileges.

If `device` is omitted, you will be prompted to select a device interactively.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

You can quiet the progress bar and other logging information by passing the `--quiet` boolean option.

You need to configure the network type and other settings:

Ethernet:
  You can setup the device OS to use ethernet by setting the `--network` option to "ethernet".

Wifi:
  You can setup the device OS to use wifi by setting the `--network` option to "wifi".
  If you set "network" to "wifi", you will need to specify the `--ssid` and `--key` option as well.

You can omit network related options to be asked about them interactively.

Examples:

	$ resin device init
	$ resin device init --application MyApp
	$ resin device init --application MyApp --network ethernet
	$ resin device init /dev/disk2 --application MyApp --network wifi --ssid MyNetwork --key secret

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --network, -n &#60;network&#62;

network type

#### --ssid, -s &#60;ssid&#62;

wifi ssid, if network is wifi

#### --key, -k &#60;key&#62;

wifi key, if network is wifi

# Environment Variables

## envs

Use this command to list all environment variables for
a particular application or device.

This command lists all custom environment variables.
If you want to see all environment variables, including private
ones used by resin, use the verbose option.

Example:

	$ resin envs --application MyApp
	$ resin envs --application MyApp --verbose
	$ resin envs --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device name

#### --verbose, -v

show private environment variables

## env rm &#60;id&#62;

Use this command to remove an environment variable from an application.

Don't remove resin specific variables, as things might not work as expected.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

If you want to eliminate a device environment variable, pass the `--device` boolean option.

Examples:

	$ resin env rm 215
	$ resin env rm 215 --yes
	$ resin env rm 215 --device

### Options

#### --yes, -y

confirm non interactively

#### --device, -d

device name

## env add &#60;key&#62; [value]

Use this command to add an enviroment variable to an application.

If value is omitted, the tool will attempt to use the variable's value
as defined in your host machine.

Use the `--device` option if you want to assign the environment variable
to a specific device.

If the value is grabbed from the environment, a warning message will be printed.
Use `--quiet` to remove it.

Examples:

	$ resin env add EDITOR vim --application MyApp
	$ resin env add TERM --application MyApp
	$ resin env add EDITOR vim --device MyDevice

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device name

## env rename &#60;id&#62; &#60;value&#62;

Use this command to rename an enviroment variable from an application.

Pass the `--device` boolean option if you want to rename a device environment variable.

Examples:

	$ resin env rename 376 emacs
	$ resin env rename 376 emacs --device

### Options

#### --device, -d

device name

# Help

## help [command...]

Get detailed help for an specific command.

Examples:

	$ resin help apps
	$ resin help os download

# Information

## version

Display the Resin CLI version.

## config

See your current Resin CLI configuration.

Configuration lives in $HOME/.resin/config.

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

To continuously stream output, and see new logs in real time, use the `--tail` option.

Note that for now you need to provide the whole UUID for this command to work correctly.

This is due to some technical limitations that we plan to address soon.

Examples:

	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828
	$ resin logs 23c73a12e3527df55c60b9ce647640c1b7da1b32d71e6a39849ac0f00db828 --tail

### Options

#### --tail, -t

continuously stream output

# Notes

## note &#60;|note&#62;

Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from `stdin`.

To view the notes, use $ resin device <uuid>.

Examples:

	$ resin note "My useful note" --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9
	$ cat note.txt | resin note --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

### Options

#### --device, --d,dev, --d,dev &#60;device&#62;

device uuid

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

