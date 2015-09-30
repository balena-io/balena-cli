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

- Authentication

	- [login [token]](#login-token-)
	- [logout](#logout)
	- [signup](#signup)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [device &#60;uuid&#62;](#device-60-uuid-62-)
	- [device register &#60;application&#62;](#device-register-60-application-62-)
	- [device rm &#60;uuid&#62;](#device-rm-60-uuid-62-)
	- [device identify &#60;uuid&#62;](#device-identify-60-uuid-62-)
	- [device rename &#60;uuid&#62; [newName]](#device-rename-60-uuid-62-newname-)
	- [device init](#device-init)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-60-id-62-)
	- [env add &#60;key&#62; [value]](#env-add-60-key-62-value-)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-60-id-62-60-value-62-)

- Help

	- [help [command...]](#help-command-)

- Information

	- [version](#version)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-60-id-62-)
	- [key rm &#60;id&#62;](#key-rm-60-id-62-)
	- [key add &#60;name&#62; [path]](#key-add-60-name-62-path-)

- Logs

	- [logs &#60;uuid&#62;](#logs-60-uuid-62-)

- Notes

	- [note &#60;|note&#62;](#note-60-note-62-)

- OS

	- [os download &#60;type&#62;](#os-download-60-type-62-)
	- [os configure &#60;image&#62; &#60;uuid&#62;](#os-configure-60-image-62-60-uuid-62-)
	- [os initialize &#60;image&#62; &#60;type&#62;](#os-initialize-60-image-62-60-type-62-)

- Wizard

	- [quickstart [name]](#quickstart-name-)

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

### Options

#### --yes, -y

confirm non interactively

# Authentication

## login [token]

Use this command to login to your resin.io account.

To login, you need your token, which is accesible from the preferences page.

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

	$ resin whoami
	johndoe

## whoami

Use this command to find out the current logged in username and email address.

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

## device register &#60;application&#62;

Use this command to register a device to an application.

Examples:

	$ resin device register MyApp

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

## device init

Use this command to download the OS image of a certain application and write it to an SD Card.

Notice this command may ask for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin device init
	$ resin device init --application MyApp

### Options

#### --application, --a,app, --a,app &#60;application&#62;

application name

#### --yes, -y

confirm non interactively

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
	$ resin env add EDITOR vim --device 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

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

# OS

## os download &#60;type&#62;

Use this command to download an unconfigured os image for a certain device type.

Examples:

	$ resin os download parallella -o ../foo/bar/parallella.img

### Options

#### --output, -o &#60;output&#62;

output path

## os configure &#60;image&#62; &#60;uuid&#62;

Use this command to configure a previously download operating system image with a device.

Examples:

	$ resin os configure ../path/rpi.img 7cf02a62a3a84440b1bb5579a3d57469148943278630b17e7fc6c4f7b465c9

## os initialize &#60;image&#62; &#60;type&#62;

Use this command to initialize a previously configured operating system image.

Examples:

	$ resin os initialize ../path/rpi.img 'raspberry-pi'

# Wizard

## quickstart [name]

Use this command to run a friendly wizard to get started with resin.io.

The wizard will guide you through:

	- Create an application.
	- Initialise an SDCard with the resin.io operating system.
	- Associate an existing project directory with your resin.io application.
	- Push your project to your devices.

Examples:

	$ sudo resin quickstart
	$ sudo resin quickstart MyApp

