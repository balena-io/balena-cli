# Balena CLI Documentation

The balena CLI (Command-Line Interface) allows you to interact with the balenaCloud and the
[balena API](https://www.balena.io/docs/reference/api/overview/) through a terminal window
on Linux, macOS or Windows. You can also write shell scripts around it, or import its Node.js
modules to use it programmatically.
As an [open-source project on GitHub](https://github.com/balena-io/balena-cli/), your contribution
is also welcome!

## Installation

Check the [balena CLI installation instructions on GitHub](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).

## Getting Started

### Choosing a shell (command prompt/terminal)

On **Windows,** the standard Command Prompt (`cmd.exe`) and
[PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/getting-started/getting-started-with-windows-powershell?view=powershell-6)
are supported. We are aware of users also having a good experience with alternative shells,
including:

* Microsoft's [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about)
  (a.k.a. Microsoft's "bash for Windows 10").
* [Git for Windows](https://git-for-windows.github.io/).
* [MinGW](http://www.mingw.org): install the `msys-rsync` and `msys-openssh` packages too.

On **macOS** and **Linux,** the standard terminal window is supported. _Optionally,_ `bash` command
auto completion may be enabled by copying the
[balena-completion.bash](https://github.com/balena-io/balena-cli/blob/master/balena-completion.bash)
file to your system's `bash_completion` directory: check [Docker's command completion
guide](https://docs.docker.com/compose/completion/) for system setup instructions.

### Logging in

Several CLI commands require access to your balenaCloud account, for example in order to push a
new release to your application. Those commands require creating a CLI login session by running:

```sh
$ balena login
```

### Proxy support

HTTP(S) proxies can be configured through any of the following methods, in order of preference:

* Set the \`BALENARC_PROXY\` environment variable in URL format (with protocol, host, port, and
  optionally basic auth).
* Alternatively, use the [balena config file](https://www.npmjs.com/package/balena-settings-client#documentation)
  (project-specific or user-level) and set the \`proxy\` setting. It can be:
  * A string in URL format, or
  * An object in the [global-tunnel-ng options format](https://www.npmjs.com/package/global-tunnel-ng#options) (which allows more control).
* Alternatively, set the conventional \`https_proxy\` / \`HTTPS_PROXY\` / \`http_proxy\` / \`HTTP_PROXY\`
environment variable (in the same standard URL format).

To get a proxy to work with the `balena ssh` command, check the
[installation instructions](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).

## Support, FAQ and troubleshooting

If you come across any problems or would like to get in touch:

* Check our [FAQ / troubleshooting document](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md).
* Ask us a question through the [balenaCloud forum](https://forums.balena.io/c/balena-cloud).
* For bug reports or feature requests,
  [have a look at the GitHub issues or create a new one](https://github.com/balena-io/balena-cli/issues/).


# CLI Command Reference

- API keys

	- [api-key generate &#60;name&#62;](#api-key-generate-name)

- Application

	- [app create &#60;name&#62;](#app-create-name)
	- [apps](#apps)
	- [app &#60;name&#62;](#app-name)
	- [app restart &#60;name&#62;](#app-restart-name)
	- [app rm &#60;name&#62;](#app-rm-name)

- Authentication

	- [login](#login)
	- [logout](#logout)
	- [signup](#signup)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [device &#60;uuid&#62;](#device-uuid)
	- [devices supported](#devices-supported)
	- [device register &#60;application&#62;](#device-register-application)
	- [device rm &#60;uuid&#62;](#device-rm-uuid)
	- [device identify &#60;uuid&#62;](#device-identify-uuid)
	- [device reboot &#60;uuid&#62;](#device-reboot-uuid)
	- [device shutdown &#60;uuid&#62;](#device-shutdown-uuid)
	- [device public-url enable &#60;uuid&#62;](#device-public-url-enable-uuid)
	- [device public-url disable &#60;uuid&#62;](#device-public-url-disable-uuid)
	- [device public-url &#60;uuid&#62;](#device-public-url-uuid)
	- [device public-url status &#60;uuid&#62;](#device-public-url-status-uuid)
	- [device rename &#60;uuid&#62; [newName]](#device-rename-uuid-newname)
	- [device move &#60;uuid&#62;](#device-move-uuid)
	- [device init](#device-init)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-id)
	- [env add &#60;name&#62; [value]](#env-add-name-value)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-id-value)

- Tags

	- [tags](#tags)
	- [tag set &#60;tagKey&#62; [value]](#tag-set-tagkey-value)
	- [tag rm &#60;tagKey&#62;](#tag-rm-tagkey)

- Help

	- [help [command...]](#help-command)

- Information

	- [version](#version)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-id)
	- [key rm &#60;id&#62;](#key-rm-id)
	- [key add &#60;name&#62; [path]](#key-add-name-path)

- Logs

	- [logs &#60;uuidOrDevice&#62;](#logs-uuidordevice)

- Sync

	- [sync [uuid]](#sync-uuid)

- SSH

	- [ssh [uuid]](#ssh-uuid)
	- [tunnel &#60;uuid&#62;](#tunnel-uuid)

- Notes

	- [note &#60;|note&#62;](#note-note)

- OS

	- [os versions &#60;type&#62;](#os-versions-type)
	- [os download &#60;type&#62;](#os-download-type)
	- [os build-config &#60;image&#62; &#60;device-type&#62;](#os-build-config-image-device-type)
	- [os configure &#60;image&#62;](#os-configure-image)
	- [os initialize &#60;image&#62;](#os-initialize-image)

- Config

	- [config read](#config-read)
	- [config write &#60;key&#62; &#60;value&#62;](#config-write-key-value)
	- [config inject &#60;file&#62;](#config-inject-file)
	- [config reconfigure](#config-reconfigure)
	- [config generate](#config-generate)

- Preload

	- [preload &#60;image&#62;](#preload-image)

- Push

	- [push &#60;applicationOrDevice&#62;](#push-applicationordevice)

- Settings

	- [settings](#settings)

- Local

	- [local configure &#60;target&#62;](#local-configure-target)
	- [local flash &#60;image&#62;](#local-flash-image)
	- [local logs [deviceIp]](#local-logs-deviceip)
	- [local scan](#local-scan)
	- [local ssh [deviceIp]](#local-ssh-deviceip)
	- [local push [deviceIp]](#local-push-deviceip)
	- [local stop [deviceIp]](#local-stop-deviceip)

- Deploy

	- [build [source]](#build-source)
	- [deploy &#60;appName&#62; [image]](#deploy-appname-image)

- Platform

	- [join [deviceIp]](#join-deviceip)
	- [leave [deviceIp]](#leave-deviceip)

- Utilities

	- [util available-drives](#util-available-drives)

# API keys

## api-key generate &#60;name&#62;

This command generates a new API key for the current user, with the given
name. The key will be logged to the console.

This key can be used to log into the CLI using 'balena login --token <key>',
or to authenticate requests to the API with an 'Authorization: Bearer <key>' header.

Examples:

	$ balena api-key generate "Jenkins Key"

# Application

## app create &#60;name&#62;

Use this command to create a new balena application.

You can specify the application device type with the `--type` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ balena devices supported

Examples:

	$ balena app create MyApp
	$ balena app create MyApp --type raspberry-pi

### Options

#### --type, -t &#60;type&#62;

application device type (Check available types with `balena devices supported`)

## apps

Use this command to list all your applications.

Notice this command only shows the most important bits of information for each app.
If you want detailed information, use balena app <name> instead.

Examples:

	$ balena apps

## app &#60;name&#62;

Use this command to show detailed information for a single application.

Examples:

	$ balena app MyApp

## app restart &#60;name&#62;

Use this command to restart all devices that belongs to a certain application.

Examples:

	$ balena app restart MyApp

## app rm &#60;name&#62;

Use this command to remove a balena application.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ balena app rm MyApp
	$ balena app rm MyApp --yes

### Options

#### --yes, -y

confirm non interactively

# Authentication

## login

Use this command to login to your balena account.

This command will prompt you to login using the following login types:

- Web authorization: open your web browser and prompt you to authorize the CLI
from the dashboard.

- Credentials: using email/password and 2FA.

- Token: using a session token or API key from the preferences page.

Examples:

	$ balena login
	$ balena login --web
	$ balena login --token "..."
	$ balena login --credentials
	$ balena login --credentials --email johndoe@gmail.com --password secret

### Options

#### --token, -t &#60;token&#62;

session token or API key

#### --web, -w

web-based login

#### --credentials, -c

credential-based login

#### --email, -e, -u &#60;email&#62;

email

#### --password, -p &#60;password&#62;

password

## logout

Use this command to logout from your balena account.

Examples:

	$ balena logout

## signup

Use this command to signup for a balena account.

If signup is successful, you'll be logged in to your new user automatically.

Examples:

	$ balena signup
	Email: johndoe@acme.com
	Password: ***********

	$ balena whoami
	johndoe

## whoami

Use this command to find out the current logged in username and email address.

Examples:

	$ balena whoami

# Device

## devices

Use this command to list all devices that belong to you.

You can filter the devices by application by using the `--application` option.

Examples:

	$ balena devices
	$ balena devices --application MyApp
	$ balena devices --app MyApp
	$ balena devices -a MyApp

### Options

#### --application, -a, --app &#60;application&#62;

application name

## device &#60;uuid&#62;

Use this command to show information about a single device.

Examples:

	$ balena device 7cf02a6

## devices supported

Use this command to get the list of all supported devices

Examples:

	$ balena devices supported

## device register &#60;application&#62;

Use this command to register a device to an application.

Examples:

	$ balena device register MyApp
	$ balena device register MyApp --uuid <uuid>

### Options

#### --uuid, -u &#60;uuid&#62;

custom uuid

## device rm &#60;uuid&#62;

Use this command to remove a device from balena.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ balena device rm 7cf02a6
	$ balena device rm 7cf02a6 --yes

### Options

#### --yes, -y

confirm non interactively

## device identify &#60;uuid&#62;

Use this command to identify a device.

In the Raspberry Pi, the ACT led is blinked several times.

Examples:

	$ balena device identify 23c73a1

## device reboot &#60;uuid&#62;

Use this command to remotely reboot a device

Examples:

	$ balena device reboot 23c73a1

### Options

#### --force, -f

force action if the update lock is set

## device shutdown &#60;uuid&#62;

Use this command to remotely shutdown a device

Examples:

	$ balena device shutdown 23c73a1

### Options

#### --force, -f

force action if the update lock is set

## device public-url enable &#60;uuid&#62;

Use this command to enable public URL for a device

Examples:

	$ balena device public-url enable 23c73a1

## device public-url disable &#60;uuid&#62;

Use this command to disable public URL for a device

Examples:

	$ balena device public-url disable 23c73a1

## device public-url &#60;uuid&#62;

Use this command to get the public URL of a device

Examples:

	$ balena device public-url 23c73a1

## device public-url status &#60;uuid&#62;

Use this command to determine if public URL is enabled for a device

Examples:

	$ balena device public-url status 23c73a1

## device rename &#60;uuid&#62; [newName]

Use this command to rename a device.

If you omit the name, you'll get asked for it interactively.

Examples:

	$ balena device rename 7cf02a6
	$ balena device rename 7cf02a6 MyPi

## device move &#60;uuid&#62;

Use this command to move a device to another application you own.

If you omit the application, you'll get asked for it interactively.

Examples:

	$ balena device move 7cf02a6
	$ balena device move 7cf02a6 --application MyNewApp

### Options

#### --application, -a, --app &#60;application&#62;

application name

## device init

Use this command to download the OS image of a certain application and write it to an SD Card.

Notice this command may ask for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ balena device init
	$ balena device init --application MyApp

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --yes, -y

confirm non interactively

#### --advanced, -v

show advanced configuration options

#### --os-version &#60;os-version&#62;

exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)

#### --drive, -d &#60;drive&#62;

the drive to write the image to, like `/dev/sdb` or `/dev/mmcblk0`. Careful with this as you can erase your hard drive. Check `balena util available-drives` for available options.

#### --config &#60;config&#62;

path to the config JSON file, see `balena os build-config`

# Environment Variables

## envs

Use this command to list the environment variables of an application
or device.

The --config option is used to list "config" variables that configure
balena features.

Service-specific variables are not currently supported. The following
examples list variables that apply to all services in an app or device.

Example:

	$ balena envs --application MyApp
	$ balena envs --application MyApp --config
	$ balena envs --device 7cf02a6

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --config, -c, -v, --verbose

show config variables

## env rm &#60;id&#62;

Use this command to remove an environment variable from an application
or device.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

The --device option selects a device instead of an application.

Service-specific variables are not currently supported. The following
examples remove variables that apply to all services in an app or device.

Examples:

	$ balena env rm 215
	$ balena env rm 215 --yes
	$ balena env rm 215 --device

### Options

#### --yes, -y

confirm non interactively

#### --device, -d

device

## env add NAME [VALUE]

Add an enviroment or config variable to an application or device, as selected
by the respective command-line options.

If VALUE is omitted, the CLI will attempt to use the value of the environment
variable of same name in the CLI process' environment. In this case, a warning
message will be printed. Use `--quiet` to suppress it.

Service-specific variables are not currently supported. The given command line
examples variables that apply to all services in an app or device.

Examples:

	$ balena env add TERM --application MyApp
	$ balena env add EDITOR vim --application MyApp
	$ balena env add EDITOR vim --device 7cf02a6

### Arguments

#### NAME

environment or config variable name

#### VALUE

variable value; if omitted, use value from CLI's enviroment

### Options

#### -a, --application APPLICATION

application name

#### -d, --device DEVICE

device UUID

#### -q, --quiet

suppress warning messages

## env rename &#60;id&#62; &#60;value&#62;

Use this command to change the value of an application or device
enviroment variable.

The --device option selects a device instead of an application.

Service-specific variables are not currently supported. The following
examples modify variables that apply to all services in an app or device.

Examples:

	$ balena env rename 376 emacs
	$ balena env rename 376 emacs --device

### Options

#### --device, -d

device

# Tags

## tags

Use this command to list all tags for
a particular application, device or release.

This command lists all application/device/release tags.

Example:

	$ balena tags --application MyApp
	$ balena tags --device 7cf02a6
	$ balena tags --release 1234

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --release, -r &#60;release&#62;

release id

## tag set &#60;tagKey&#62; [value]

Use this command to set a tag to an application, device or release.

You can optionally provide a value to be associated with the created
tag, as an extra argument after the tag key. When the value isn't
provided, a tag with an empty value is created.

Examples:

	$ balena tag set mySimpleTag --application MyApp
	$ balena tag set myCompositeTag myTagValue --application MyApp
	$ balena tag set myCompositeTag myTagValue --device 7cf02a6
	$ balena tag set myCompositeTag myTagValue --release 1234
	$ balena tag set myCompositeTag "my tag value with whitespaces" --release 1234

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --release, -r &#60;release&#62;

release id

## tag rm &#60;tagKey&#62;

Use this command to remove a tag from an application, device or release.

Examples:

	$ balena tag rm myTagKey --application MyApp
	$ balena tag rm myTagKey --device 7cf02a6
	$ balena tag rm myTagKey --release 1234

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --release, -r &#60;release&#62;

release id

# Help

## help [command...]

Get detailed help for an specific command.

Examples:

	$ balena help apps
	$ balena help os download

### Options

#### --verbose, -v

show additional commands

# Information

## version

Display the balena CLI version.

# Keys

## keys

Use this command to list all your SSH keys.

Examples:

	$ balena keys

## key &#60;id&#62;

Use this command to show information about a single SSH key.

Examples:

	$ balena key 17

## key rm &#60;id&#62;

Use this command to remove a SSH key from balena.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ balena key rm 17
	$ balena key rm 17 --yes

### Options

#### --yes, -y

confirm non interactively

## key add &#60;name&#62; [path]

Use this command to associate a new SSH key with your account.

If `path` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ balena key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | balena key add Main

# Logs

## logs &#60;uuidOrDevice&#62;

Use this command to show logs for a specific device.

By default, the command prints all log messages and exits.

To continuously stream output, and see new logs in real time, use the `--tail` option.

If an IP or .local address is passed to this command, logs are displayed from
a local mode device with that address. Note that --tail is implied
when this command is provided a local mode device.

Logs from a single service can be displayed with the --service flag. Just system logs
can be shown with the --system flag. Note that these flags can be used together.

Examples:

	$ balena logs 23c73a1
	$ balena logs 23c73a1 --tail

	$ balena logs 192.168.0.31
	$ balena logs 192.168.0.31 --service my-service

	$ balena logs 23c73a1.local --system
	$ balena logs 23c73a1.local --system --service my-service

### Options

#### --tail, -t

continuously stream output

#### --service, -s &#60;service&#62;

Only show logs for a single service. This can be used in combination with --system

#### --system, -S

Only show system logs. This can be used in combination with --service.

# Sync

## sync [uuid]

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
Deprecation notice: please note that `balena sync` is deprecated and will
be removed in a future release of the CLI. We are working on an exciting
replacement that will be released soon!  
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Warning: 'balena sync' requires an openssh-compatible client and 'rsync' to
be correctly installed in your shell environment. For more information (including
Windows support) please check the README here: https://github.com/balena-io/balena-cli

Use this command to sync your local changes to a certain device on the fly.

After every 'balena sync' the updated settings will be saved in
'<source>/.balena-sync.yml' and will be used in later invocations. You can
also change any option by editing '.balena-sync.yml' directly.

Here is an example '.balena-sync.yml' :

	$ cat $PWD/.balena-sync.yml
	uuid: 7cf02a6
	destination: '/usr/src/app'
	before: 'echo Hello'
	after: 'echo Done'
	ignore:
		- .git
		- node_modules/

Command line options have precedence over the ones saved in '.balena-sync.yml'.

If '.gitignore' is found in the source directory then all explicitly listed files will be
excluded from the syncing process. You can choose to change this default behavior with the
'--skip-gitignore' option.

Examples:

	$ balena sync 7cf02a6 --source . --destination /usr/src/app
	$ balena sync 7cf02a6 -s /home/user/myBalenaProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	$ balena sync --ignore lib/
	$ balena sync --verbose false
	$ balena sync

### Options

#### --source, -s &#60;path&#62;

local directory path to synchronize to device

#### --destination, -d &#60;path&#62;

destination path on device

#### --ignore, -i &#60;paths&#62;

comma delimited paths to ignore when syncing

#### --skip-gitignore

do not parse excluded/included files from .gitignore

#### --skip-restart

do not restart container after syncing

#### --before, -b &#60;command&#62;

execute a command before syncing

#### --after, -a &#60;command&#62;

execute a command after syncing

#### --port, -t &#60;port&#62;

ssh port

#### --progress, -p

show progress

#### --verbose, -v

increase verbosity

# SSH

## ssh [uuid]

Warning: 'balena ssh' requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check the README here: https://github.com/balena-io/balena-cli

Use this command to get a shell into the running application container of
your device.

Examples:

	$ balena ssh MyApp
	$ balena ssh 7cf02a6
	$ balena ssh 7cf02a6 --port 8080
	$ balena ssh 7cf02a6 -v
	$ balena ssh 7cf02a6 -s
	$ balena ssh 7cf02a6 --noninteractive

### Options

#### --port, -p &#60;port&#62;

ssh gateway port

#### --verbose, -v

increase verbosity

#### --host, -s

access host OS (for devices with balenaOS >= 2.0.0+rev1)

#### --noproxy

don't use the proxy configuration for this connection. Only makes sense if you've configured proxy globally.

#### --noninteractive

run command non-interactively, do not automatically suggest devices to connect to if UUID not found

## tunnel &#60;uuid&#62;

Use this command to open local ports which tunnel to listening ports on your balenaOS device.

For example, you could open port 8080 on your local machine to connect to your managed balenaOS
device running a web server listening on port 3000.

You can tunnel multiple ports at any given time.

Examples:

	# map remote port 22222 to localhost:22222
	$ balena tunnel abcde12345 -p 22222

	# map remote port 22222 to localhost:222
	$ balena tunnel abcde12345 -p 22222:222

	# map remote port 22222 to any address on your host machine, port 22222
	$ balena tunnel abcde12345 -p 22222:0.0.0.0

	# map remote port 22222 to any address on your host machine, port 222
	$ balena tunnel abcde12345 -p 22222:0.0.0.0:222

	# multiple port tunnels can be specified at any one time
	$ balena tunnel abcde12345 -p 8080:3000 -p 8081:9000

### Options

#### --port, -p &#60;port&#62;

The mapping of remote to local ports.

# Notes

## note &#60;|note&#62;

Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from `stdin`.

To view the notes, use $ balena device <uuid>.

Examples:

	$ balena note "My useful note" --device 7cf02a6
	$ cat note.txt | balena note --device 7cf02a6

### Options

#### --device, -d, --dev &#60;device&#62;

device uuid

# OS

## os versions &#60;type&#62;

Use this command to show the available balenaOS versions for a certain device type.
Check available types with `balena devices supported`

Example:

	$ balena os versions raspberrypi3

## os download &#60;type&#62;

Use this command to download an unconfigured os image for a certain device type.
Check available types with `balena devices supported`

If version is not specified the newest stable (non-pre-release) version of OS
is downloaded if available, or the newest version otherwise (if all existing
versions for the given device type are pre-release).

You can pass `--version menu` to pick the OS version from the interactive menu
of all available versions.

Examples:

	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 1.24.1
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^1.20.0
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu

### Options

#### --output, -o &#60;output&#62;

output path

#### --version &#60;version&#62;

exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)

## os build-config &#60;image&#62; &#60;device-type&#62;

Use this command to prebuild the OS config once and skip the interactive part of `balena os configure`.

Example:

	$ balena os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json
	$ balena os configure ../path/rpi3.img --device 7cf02a6 --config rpi3-config.json

### Options

#### --advanced, -v

show advanced configuration options

#### --output, -o &#60;output&#62;

the path to the output JSON file

## os configure &#60;image&#62;

Use this command to configure a previously downloaded operating system image for
the specific device or for an application generally.

This command will try to automatically determine the operating system version in order
to correctly configure the image. It may fail to do so however, in which case you'll
have to call this command again with the exact version number of the targeted image.

Note that device api keys are only supported on balenaOS 2.0.3+.

This command still supports the *deprecated* format where the UUID and optionally device key
are passed directly on the command line, but the recommended way is to pass either an --app or
--device argument. The deprecated format will be removed in a future release.

In case that you want to configure an image for an application with mixed device types,
you can pass the --device-type argument along with --app to specify the target device type.

Examples:

	$ balena os configure ../path/rpi3.img --device 7cf02a6
	$ balena os configure ../path/rpi3.img --device 7cf02a6 --device-api-key <existingDeviceKey>
	$ balena os configure ../path/rpi3.img --app MyApp
	$ balena os configure ../path/rpi3.img --app MyApp --version 2.12.7
	$ balena os configure ../path/rpi3.img --app MyFinApp --device-type raspberrypi3

### Options

#### --advanced, -v

show advanced configuration options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --deviceApiKey, -k &#60;device-api-key&#62;

custom device key - note that this is only supported on balenaOS 2.0.3+

#### --deviceType &#60;device-type&#62;

device type slug

#### --version &#60;version&#62;

a balenaOS version

#### --config &#60;config&#62;

path to the config JSON file, see `balena os build-config`

## os initialize &#60;image&#62;

Use this command to initialize a device with previously configured operating system image.

Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.

Examples:

	$ balena os initialize ../path/rpi.img --type 'raspberry-pi'

### Options

#### --yes, -y

confirm non interactively

#### --type, -t &#60;type&#62;

device type (Check available types with `balena devices supported`)

#### --drive, -d &#60;drive&#62;

the drive to write the image to, like `/dev/sdb` or `/dev/mmcblk0`. Careful with this as you can erase your hard drive. Check `balena util available-drives` for available options.

# Config

## config read

Use this command to read the config.json file from the mounted filesystem (e.g. SD card) of a provisioned device"

Examples:

	$ balena config read --type raspberry-pi
	$ balena config read --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `balena devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## config write &#60;key&#62; &#60;value&#62;

Use this command to write the config.json file to the mounted filesystem (e.g. SD card) of a provisioned device

Examples:

	$ balena config write --type raspberry-pi username johndoe
	$ balena config write --type raspberry-pi --drive /dev/disk2 username johndoe
	$ balena config write --type raspberry-pi files.network/settings "..."

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `balena devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## config inject &#60;file&#62;

Use this command to inject a config.json file to the mounted filesystem
(e.g. SD card or mounted balenaOS image) of a provisioned device"

Examples:

	$ balena config inject my/config.json --type raspberry-pi
	$ balena config inject my/config.json --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `balena devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## config reconfigure

Use this command to reconfigure a provisioned device

Examples:

	$ balena config reconfigure --type raspberry-pi
	$ balena config reconfigure --type raspberry-pi --advanced
	$ balena config reconfigure --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `balena devices supported`)

#### --drive, -d &#60;drive&#62;

drive

#### --advanced, -v

show advanced commands

## config generate

Use this command to generate a config.json for a device or application.

Calling this command with the exact version number of the targeted image is required.

This is interactive by default, but you can do this automatically without interactivity
by specifying an option for each question on the command line, if you know the questions
that will be asked for the relevant device type.

In case that you want to configure an image for an application with mixed device types,
you can pass the --device-type argument along with --app to specify the target device type.

Examples:

	$ balena config generate --device 7cf02a6 --version 2.12.7
	$ balena config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key
	$ balena config generate --device 7cf02a6 --version 2.12.7 --device-api-key <existingDeviceKey>
	$ balena config generate --device 7cf02a6 --version 2.12.7 --output config.json
	$ balena config generate --app MyApp --version 2.12.7
	$ balena config generate --app MyApp --version 2.12.7 --device-type fincm3
	$ balena config generate --app MyApp --version 2.12.7 --output config.json
	$ balena config generate --app MyApp --version 2.12.7 --network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 1

### Options

#### --version &#60;version&#62;

a balenaOS version

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --deviceApiKey, -k &#60;device-api-key&#62;

custom device key - note that this is only supported on balenaOS 2.0.3+

#### --deviceType &#60;device-type&#62;

device type slug

#### --generate-device-api-key

generate a fresh device key for the device

#### --output, -o &#60;output&#62;

output

#### --network &#60;network&#62;

the network type to use: ethernet or wifi

#### --wifiSsid &#60;wifiSsid&#62;

the wifi ssid to use (used only if --network is set to wifi)

#### --wifiKey &#60;wifiKey&#62;

the wifi key to use (used only if --network is set to wifi)

#### --appUpdatePollInterval &#60;appUpdatePollInterval&#62;

how frequently (in minutes) to poll for application updates

# Preload

## preload &#60;image&#62;

Warning: "balena preload" requires Docker to be correctly installed in
your shell environment. For more information (including Windows support)
please check the README here: https://github.com/balena-io/balena-cli .

Use this command to preload an application to a local disk image (or
Edison zip archive) with a built release from balena.

Examples:

	$ balena preload balena.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image image.png
	$ balena preload balena.img

### Options

#### --app, -a &#60;appId&#62;

id of the application to preload

#### --commit, -c &#60;hash&#62;

The commit hash for a specific application release to preload, use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the latest, but can be
manually pinned using https://github.com/balena-io-projects/staged-releases .

#### --splash-image, -s &#60;splashImage.png&#62;

path to a png image to replace the splash screen

#### --dont-check-arch

Disables check for matching architecture in image and application

#### --pin-device-to-release, -p

Pin the preloaded device (not application) to the preloaded release on provision

#### --docker, -P &#60;docker&#62;

Path to a local docker socket (e.g. /var/run/docker.sock)

#### --dockerHost, -h &#60;dockerHost&#62;

Docker daemon hostname or IP address (dev machine or balena device) 

#### --dockerPort, -p &#60;dockerPort&#62;

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca &#60;ca&#62;

Docker host TLS certificate authority file

#### --cert &#60;cert&#62;

Docker host TLS certificate file

#### --key &#60;key&#62;

Docker host TLS key file

# Push

## push &#60;applicationOrDevice&#62;

This command can be used to start a build on the remote balena cloud builders,
or a local mode balena device.

When building on the balenaCloud servers, the given source directory will be
sent to the remote server. This can be used as a drop-in replacement for the
"git push" deployment method.

When building on a local mode device, the given source directory will be
built on the device, and the resulting containers will be run on the device.
Logs will be streamed back from the device as part of the same invocation.
The web dashboard can be used to switch a device to local mode:
https://www.balena.io/docs/learn/develop/local-mode/
Note that local mode requires a supervisor version of at least v7.21.0.
The logs from only a single service can be shown with the --service flag, and
showing only the system logs can be achieved with --system. Note that these
flags can be used together.

It is also possible to run a push to a local mode device in live mode.
This will watch for changes in the source directory and perform an
in-place build in the running containers [BETA].

The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:

	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'

Examples:

	$ balena push myApp
	$ balena push myApp --source <source directory>
	$ balena push myApp -s <source directory>

	$ balena push 10.0.0.1
	$ balena push 10.0.0.1 --source <source directory>
	$ balena push 10.0.0.1 --service my-service
	$ balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value

	$ balena push 23c73a1.local --system
	$ balena push 23c73a1.local --system --service my-service

### Options

#### --source, -s &#60;source&#62;

The source that should be sent to the balena builder to be built (defaults to the current directory)

#### --emulated, -e

Force an emulated build to occur on the remote builder

#### --dockerfile &#60;Dockerfile&#62;

Alternative Dockerfile name/path, relative to the source folder

#### --nocache, -c

Don't use cache when building this project

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a local YAML or JSON file containing Docker registry passwords used to pull base images

#### --live, -l

Note this feature is in beta.

Start a live session with the containers pushed to a local mode device.
The project source folder is watched for filesystem events, and changes
to files and folders are automatically synchronized to the running
containers. The synchronisation is only in one direction, from this machine to
the device, and changes made on the device itself may be overwritten.
This feature requires a device running supervisor version v9.7.0 or greater.

#### --detached, -d

Don't tail application logs when pushing to a local mode device

#### --service &#60;service&#62;

Only show logs from a single service. This can be used in combination with --system.
Only valid when pushing to a local mode device.

#### --system

Only show system logs. This can be used in combination with --service.
Only valid when pushing to a local mode device.

#### --env &#60;env&#62;

When performing a push to device, run the built containers with environment
variables provided with this argument. Environment variables can be applied
to individual services by adding their service name before the argument,
separated by a colon, e.g:
	--env main:MY_ENV=value
Note that if the service name cannot be found in the composition, the entire
left hand side of the = character will be treated as the variable name.

# Settings

## settings

Use this command to display detected settings

Examples:

	$ balena settings

# Local

## local configure &#60;target&#62;

Use this command to configure or reconfigure a balenaOS drive or image.

Examples:

	$ balena local configure /dev/sdc
	$ balena local configure path/to/image.img

## local flash &#60;image&#62;

Use this command to flash a balenaOS image to a drive.

Examples:

	$ balena local flash path/to/balenaos.img[.zip|.gz|.bz2|.xz]
	$ balena local flash path/to/balenaos.img --drive /dev/disk2
	$ balena local flash path/to/balenaos.img --drive /dev/disk2 --yes

### Options

#### --yes, -y

confirm non-interactively

#### --drive, -d &#60;drive&#62;

drive

## local logs [deviceIp]


Examples:

	$ balena local logs
	$ balena local logs -f
	$ balena local logs 192.168.1.10
	$ balena local logs 192.168.1.10 -f
	$ balena local logs 192.168.1.10 -f --app-name myapp

### Options

#### --follow, -f

follow log

#### --app-name, -a &#60;name&#62;

name of container to get logs from

## local scan


Examples:

	$ balena local scan
	$ balena local scan --timeout 120
	$ balena local scan --verbose

### Options

#### --verbose, -v

Display full info

#### --timeout, -t &#60;timeout&#62;

Scan timeout in seconds

## local ssh [deviceIp]

Warning: 'balena local ssh' requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check the README here: https://github.com/balena-io/balena-cli

Use this command to get a shell into the running application container of
your device.

The '--host' option will get you a shell into the Host OS of the balenaOS device.
No option will return a list of containers to enter or you can explicitly select
one by passing its name to the --container option

Examples:

	$ balena local ssh
	$ balena local ssh --host
	$ balena local ssh --container chaotic_water
	$ balena local ssh --container chaotic_water --port 22222
	$ balena local ssh --verbose

### Options

#### --verbose, -v

increase verbosity

#### --host, -s

get a shell into the host OS

#### --container, -c &#60;container&#62;

name of container to access

#### --port, -p &#60;port&#62;

ssh port number (default: 22222)

## local push [deviceIp]

- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -  
Deprecation notice: `balena local push` is deprecated and will be removed in a
future release of the CLI. Please use `balena push <ipAddress>` instead.  
- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -

Use this command to push your local changes to a container on a LAN-accessible
balenaOS device on the fly.

This command requires an openssh-compatible 'ssh' client and 'rsync' to be
available in the executable PATH of the shell environment. For more information
(including Windows support) please check the README at:
https://github.com/balena-io/balena-cli

If `Dockerfile` or any file in the 'build-triggers' list is changed,
a new container will be built and run on your device.
If not, changes will simply be synced with `rsync` into the application container.

After every 'balena local push' the updated settings will be saved in
'<source>/.balena-sync.yml' and will be used in later invocations. You can
also change any option by editing '.balena-sync.yml' directly.

Here is an example '.balena-sync.yml' :

	$ cat $PWD/.balena-sync.yml
	local_balenaos:
		app-name: local-app
		build-triggers:
			- Dockerfile: file-hash-abcdefabcdefabcdefabcdefabcdefabcdef
			- package.json: file-hash-abcdefabcdefabcdefabcdefabcdefabcdef
		environment:
			- MY_VARIABLE=123


Command line options have precedence over the ones saved in '.balena-sync.yml'.

If '.gitignore' is found in the source directory then all explicitly listed files will be
excluded when using rsync to update the container. You can choose to change this default behavior with the
'--skip-gitignore' option.

Examples:

	$ balena local push
	$ balena local push --app-name test-server --build-triggers package.json,requirements.txt
	$ balena local push --force-build
	$ balena local push --force-build --skip-logs
	$ balena local push --ignore lib/
	$ balena local push --verbose false
	$ balena local push 192.168.2.10 --source . --destination /usr/src/app
	$ balena local push 192.168.2.10 -s /home/user/balenaProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'

### Options

#### --source, -s &#60;path&#62;

root of project directory to push

#### --destination, -d &#60;path&#62;

destination path on device container

#### --ignore, -i &#60;paths&#62;

comma delimited paths to ignore when syncing with 'rsync'

#### --skip-gitignore

do not parse excluded/included files from .gitignore

#### --before, -b &#60;command&#62;

execute a command before pushing

#### --after, -a &#60;command&#62;

execute a command after pushing

#### --progress, -p

show progress

#### --skip-logs

do not stream logs after push

#### --verbose, -v

increase verbosity

#### --app-name, -n &#60;name&#62;

application name - may contain lowercase characters, digits and one or more dashes. It may not start or end with a dash.

#### --build-triggers, -r &#60;files&#62;

comma delimited file list that will trigger a container rebuild if changed

#### --force-build, -f

force a container build and run

#### --env, -e &#60;env&#62;

environment variable (e.g. --env 'ENV=value'). Multiple --env parameters are supported.

## local stop [deviceIp]


Examples:

	$ balena local stop
	$ balena local stop --app-name myapp
	$ balena local stop --all
	$ balena local stop 192.168.1.10
	$ balena local stop 192.168.1.10 --app-name myapp

### Options

#### --all

stop all containers

#### --app-name, -a &#60;name&#62;

name of container to stop

# Deploy

## build [source]

Use this command to build an image or a complete multicontainer project with
the provided docker daemon in your development machine or balena device.
(See also the `balena push` command for the option of building images in the
balenaCloud build servers.)

You must provide either an application or a device-type/architecture pair to use
the balena Dockerfile pre-processor (e.g. Dockerfile.template -> Dockerfile).

This command will look into the given source directory (or the current working
directory if one isn't specified) for a docker-compose.yml file. If it is found,
this command will build each service defined in the compose file. If a compose
file isn't found, the command will look for a Dockerfile[.template] file (or
alternative Dockerfile specified with the `-f` option), and if yet that isn't
found, it will try to generate one.

The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:

	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'

Examples:

	$ balena build
	$ balena build ./source/
	$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated
	$ balena build --application MyApp ./source/
	$ balena build --docker '/var/run/docker.sock'
	$ balena build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem

### Options

#### --arch, -A &#60;arch&#62;

The architecture to build for

#### --deviceType, -d &#60;deviceType&#62;

The type of device this build is for

#### --application, -a &#60;application&#62;

The target balena application this build is for

#### --projectName, -n &#60;projectName&#62;

Specify an alternate project name; default is the directory name

#### --emulated, -e

Run an emulated build using Qemu

#### --dockerfile &#60;Dockerfile&#62;

Alternative Dockerfile name/path, relative to the source folder

#### --logs

Display full log output

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a YAML or JSON file with passwords for a private Docker registry

#### --docker, -P &#60;docker&#62;

Path to a local docker socket (e.g. /var/run/docker.sock)

#### --dockerHost, -h &#60;dockerHost&#62;

Docker daemon hostname or IP address (dev machine or balena device) 

#### --dockerPort, -p &#60;dockerPort&#62;

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca &#60;ca&#62;

Docker host TLS certificate authority file

#### --cert &#60;cert&#62;

Docker host TLS certificate file

#### --key &#60;key&#62;

Docker host TLS key file

#### --tag, -t &#60;tag&#62;

The alias to the generated image

#### --buildArg, -B &#60;arg&#62;

Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

#### --nocache

Don't use docker layer caching when building

#### --squash

Squash newly built layers into a single new layer

## deploy &#60;appName&#62; [image]

Usage: `deploy <appName> ([image] | --build [--source build-dir])`

Use this command to deploy an image or a complete multicontainer project to an
application, optionally building it first. The source images are searched for
(and optionally built) using the docker daemon in your development machine or
balena device. (See also the `balena push` command for the option of building
the image in the balenaCloud build servers.)

Unless an image is specified, this command will look into the current directory
(or the one specified by --source) for a docker-compose.yml file.  If one is
found, this command will deploy each service defined in the compose file,
building it first if an image for it doesn't exist. If a compose file isn't
found, the command will look for a Dockerfile[.template] file (or alternative
Dockerfile specified with the `-f` option), and if yet that isn't found, it
will try to generate one.

To deploy to an app on which you're a collaborator, use
`balena deploy <appOwnerUsername>/<appName>`.

When --build is used, all options supported by `balena build` are also supported
by this command.

The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:

	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'

Examples:

	$ balena deploy myApp
	$ balena deploy myApp --build --source myBuildDir/
	$ balena deploy myApp myApp/myImage

### Options

#### --source, -s &#60;source&#62;

Specify an alternate source directory; default is the working directory

#### --build, -b

Force a rebuild before deploy

#### --nologupload

Don't upload build logs to the dashboard with image (if building)

#### --projectName, -n &#60;projectName&#62;

Specify an alternate project name; default is the directory name

#### --emulated, -e

Run an emulated build using Qemu

#### --dockerfile &#60;Dockerfile&#62;

Alternative Dockerfile name/path, relative to the source folder

#### --logs

Display full log output

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a YAML or JSON file with passwords for a private Docker registry

#### --docker, -P &#60;docker&#62;

Path to a local docker socket (e.g. /var/run/docker.sock)

#### --dockerHost, -h &#60;dockerHost&#62;

Docker daemon hostname or IP address (dev machine or balena device) 

#### --dockerPort, -p &#60;dockerPort&#62;

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca &#60;ca&#62;

Docker host TLS certificate authority file

#### --cert &#60;cert&#62;

Docker host TLS certificate file

#### --key &#60;key&#62;

Docker host TLS key file

#### --tag, -t &#60;tag&#62;

The alias to the generated image

#### --buildArg, -B &#60;arg&#62;

Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

#### --nocache

Don't use docker layer caching when building

#### --squash

Squash newly built layers into a single new layer

# Platform

## join [deviceIp]

Use this command to move a local device to an application on another balena server.

For example, you could provision a device against an openBalena installation
where you perform end-to-end tests and then move it to balenaCloud when it's
ready for production.

Moving a device between applications on the same server is not supported.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This usually requires root privileges.

Examples:

	$ balena join
	$ balena join balena.local
	$ balena join balena.local --application MyApp
	$ balena join 192.168.1.25
	$ balena join 192.168.1.25 --application MyApp

### Options

#### --application, -a &#60;application&#62;

The name of the application the device should join

## leave [deviceIp]

Use this command to make a local device leave the balena server it is
provisioned on. This effectively makes the device "unmanaged".

The device entry on the server is preserved after running this command,
so the device can subsequently re-join the server if needed.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This usually requires root privileges.

Examples:

	$ balena leave
	$ balena leave balena.local
	$ balena leave 192.168.1.25

# Utilities

## util available-drives

Use this command to list your machine's drives usable for writing the OS image to.
Skips the system drives.
