# Resin CLI Documentation

This tool allows you to interact with the resin.io api from the comfort of your command line.

Please make sure your system meets the requirements as specified in the [README](https://github.com/resin-io/resin-cli).

## Install the CLI

### Npm install

The best supported way to install the CLI is from npm:

	$ npm install resin-cli -g --production --unsafe-perm

`--unsafe-perm` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

### Standalone install

Alternatively, if you don't have a node or pre-gyp environment, you can still install the CLI as a standalone
binary. **This is in experimental and may not work perfectly yet in all environments**, but works well in
initial cross-platform testing, so it may be useful, and we'd love your feedback if you hit any issues.

To install the CLI as a standalone binary:

* Download the latest zip for your OS from https://github.com/resin-io/resin-cli/releases.
* Extract the contents, putting the `resin-cli` folder somewhere appropriate for your system (e.g. `C:/resin-cli`, `/usr/local/lib/resin-cli`, etc).
* Add the `resin-cli` folder to your `PATH`. (
[Windows instructions](https://www.computerhope.com/issues/ch000549.htm),
[Linux instructions](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix),
[OSX instructions](https://stackoverflow.com/questions/22465332/setting-path-environment-variable-in-osx-permanently))
* Running `resin` in a fresh command line should print the resin CLI help.

To update in future, simply download a new release and replace the extracted folder.

Have any problems, or see any unexpected behaviour? Please file an issue!

## Getting started

Once you have the CLI installed, you'll need to log in, so it can access everything in your resin.io account.

To authenticate yourself, run:

	$ resin login

You now have access to all the commands referenced below.

## Proxy support

The CLI does support HTTP(S) proxies.

You can configure the proxy using several methods (in order of their precedence):

* set the `RESINRC_PROXY` environment variable in the URL format (with protocol, host, port, and optionally the basic auth),
* use the [resin config file](https://www.npmjs.com/package/resin-settings-client#documentation) (project-specific or user-level)
and set the `proxy` setting. This can be:
	* a string in the URL format,
	* or an object following [this format](https://www.npmjs.com/package/global-tunnel-ng#options), which allows more control,
* or set the conventional `https_proxy` / `HTTPS_PROXY` / `http_proxy` / `HTTP_PROXY`
environment variable (in the same standard URL format).

# Table of contents

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
	- [device rename &#60;uuid&#62; [newName]](#device-rename-uuid--newname)
	- [device move &#60;uuid&#62;](#device-move-uuid)
	- [device init](#device-init)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-id)
	- [env add &#60;key&#62; [value]](#env-add-key--value)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-id--value)

- Help

	- [help [command...]](#help-command)

- Information

	- [version](#version)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-id)
	- [key rm &#60;id&#62;](#key-rm-id)
	- [key add &#60;name&#62; [path]](#key-add-name--path)

- Logs

	- [logs &#60;uuid&#62;](#logs-uuid)

- Sync

	- [sync [uuid]](#sync-uuid)

- SSH

	- [ssh [uuid]](#ssh-uuid)

- Notes

	- [note &#60;|note&#62;](#note-note)

- OS

	- [os versions &#60;type&#62;](#os-versions-type)
	- [os download &#60;type&#62;](#os-download-type)
	- [os build-config &#60;image&#62; &#60;device-type&#62;](#os-build-config-image--device-type)
	- [os configure &#60;image&#62; [uuid] [deviceApiKey]](#os-configure-image--uuid--deviceapikey)
	- [os initialize &#60;image&#62;](#os-initialize-image)

- Config

	- [config read](#config-read)
	- [config write &#60;key&#62; &#60;value&#62;](#config-write-key--value)
	- [config inject &#60;file&#62;](#config-inject-file)
	- [config reconfigure](#config-reconfigure)
	- [config generate](#config-generate)

- Preload

	- [preload &#60;image&#62;](#preload-image)

- Settings

	- [settings](#settings)

- Wizard

	- [quickstart [name]](#quickstart-name)

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
	- [deploy &#60;appName&#62; [image]](#deploy-appname--image)

- Utilities

	- [util available-drives](#util-available-drives)

# Application

## <a name="#app-create-name"></a>app create &#60;name&#62;

Use this command to create a new resin.io application.

You can specify the application device type with the `--type` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with

	$ resin devices supported

Examples:

	$ resin app create MyApp
	$ resin app create MyApp --type raspberry-pi

### Options

#### --type, -t &#60;type&#62;

application device type (Check available types with `resin devices supported`)

## <a name="#apps"></a>apps

Use this command to list all your applications.

Notice this command only shows the most important bits of information for each app.
If you want detailed information, use resin app <name> instead.

Examples:

	$ resin apps

## <a name="#app-name"></a>app &#60;name&#62;

Use this command to show detailed information for a single application.

Examples:

	$ resin app MyApp

## <a name="#app-restart-name"></a>app restart &#60;name&#62;

Use this command to restart all devices that belongs to a certain application.

Examples:

	$ resin app restart MyApp

## <a name="#app-rm-name"></a>app rm &#60;name&#62;

Use this command to remove a resin.io application.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin app rm MyApp
	$ resin app rm MyApp --yes

### Options

#### --yes, -y

confirm non interactively

# Authentication

## <a name="#login"></a>login

Use this command to login to your resin.io account.

This command will prompt you to login using the following login types:

- Web authorization: open your web browser and prompt you to authorize the CLI
from the dashboard.

- Credentials: using email/password and 2FA.

- Token: using the authentication token from the preferences page.

Examples:

	$ resin login
	$ resin login --web
	$ resin login --token "..."
	$ resin login --credentials
	$ resin login --credentials --email johndoe@gmail.com --password secret

### Options

#### --token, -t &#60;token&#62;

auth token

#### --web, -w

web-based login

#### --credentials, -c

credential-based login

#### --email, -e, -u &#60;email&#62;

email

#### --password, -p &#60;password&#62;

password

## <a name="#logout"></a>logout

Use this command to logout from your resin.io account.o

Examples:

	$ resin logout

## <a name="#signup"></a>signup

Use this command to signup for a resin.io account.

If signup is successful, you'll be logged in to your new user automatically.

Examples:

	$ resin signup
	Email: johndoe@acme.com
	Password: ***********

	$ resin whoami
	johndoe

## <a name="#whoami"></a>whoami

Use this command to find out the current logged in username and email address.

Examples:

	$ resin whoami

# Device

## <a name="#devices"></a>devices

Use this command to list all devices that belong to you.

You can filter the devices by application by using the `--application` option.

Examples:

	$ resin devices
	$ resin devices --application MyApp
	$ resin devices --app MyApp
	$ resin devices -a MyApp

### Options

#### --application, -a, --app &#60;application&#62;

application name

## <a name="#device-uuid"></a>device &#60;uuid&#62;

Use this command to show information about a single device.

Examples:

	$ resin device 7cf02a6

## <a name="#devices-supported"></a>devices supported

Use this command to get the list of all supported devices

Examples:

	$ resin devices supported

## <a name="#device-register-application"></a>device register &#60;application&#62;

Use this command to register a device to an application.

Note that device api keys are only supported on ResinOS 2.0.3+

Examples:

	$ resin device register MyApp
	$ resin device register MyApp --uuid <uuid>
	$ resin device register MyApp --uuid <uuid> --device-api-key <existingDeviceKey>

### Options

#### --uuid, -u &#60;uuid&#62;

custom uuid

#### --deviceApiKey, -k &#60;device-api-key&#62;

custom device key - note that this is only supported on ResinOS 2.0.3+

## <a name="#device-rm-uuid"></a>device rm &#60;uuid&#62;

Use this command to remove a device from resin.io.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin device rm 7cf02a6
	$ resin device rm 7cf02a6 --yes

### Options

#### --yes, -y

confirm non interactively

## <a name="#device-identify-uuid"></a>device identify &#60;uuid&#62;

Use this command to identify a device.

In the Raspberry Pi, the ACT led is blinked several times.

Examples:

	$ resin device identify 23c73a1

## <a name="#device-reboot-uuid"></a>device reboot &#60;uuid&#62;

Use this command to remotely reboot a device

Examples:

	$ resin device reboot 23c73a1

### Options

#### --force, -f

force action if the update lock is set

## <a name="#device-shutdown-uuid"></a>device shutdown &#60;uuid&#62;

Use this command to remotely shutdown a device

Examples:

	$ resin device shutdown 23c73a1

### Options

#### --force, -f

force action if the update lock is set

## <a name="#device-public-url-enable-uuid"></a>device public-url enable &#60;uuid&#62;

Use this command to enable public URL for a device

Examples:

	$ resin device public-url enable 23c73a1

## <a name="#device-public-url-disable-uuid"></a>device public-url disable &#60;uuid&#62;

Use this command to disable public URL for a device

Examples:

	$ resin device public-url disable 23c73a1

## <a name="#device-public-url-uuid"></a>device public-url &#60;uuid&#62;

Use this command to get the public URL of a device

Examples:

	$ resin device public-url 23c73a1

## <a name="#device-public-url-status-uuid"></a>device public-url status &#60;uuid&#62;

Use this command to determine if public URL is enabled for a device

Examples:

	$ resin device public-url status 23c73a1

## <a name="#device-rename-uuid--newname"></a>device rename &#60;uuid&#62; [newName]

Use this command to rename a device.

If you omit the name, you'll get asked for it interactively.

Examples:

	$ resin device rename 7cf02a6
	$ resin device rename 7cf02a6 MyPi

## <a name="#device-move-uuid"></a>device move &#60;uuid&#62;

Use this command to move a device to another application you own.

If you omit the application, you'll get asked for it interactively.

Examples:

	$ resin device move 7cf02a6
	$ resin device move 7cf02a6 --application MyNewApp

### Options

#### --application, -a, --app &#60;application&#62;

application name

## <a name="#device-init"></a>device init

Use this command to download the OS image of a certain application and write it to an SD Card.

Notice this command may ask for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin device init
	$ resin device init --application MyApp

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

the drive to write the image to, like `/dev/sdb` or `/dev/mmcblk0`. Careful with this as you can erase your hard drive. Check `resin util available-drives` for available options.

#### --config &#60;config&#62;

path to the config JSON file, see `resin os build-config`

# Environment Variables

## <a name="#envs"></a>envs

Use this command to list all environment variables for
a particular application or device.

This command lists all custom environment variables.
If you want to see all environment variables, including private
ones used by resin, use the verbose option.

Example:

	$ resin envs --application MyApp
	$ resin envs --application MyApp --verbose
	$ resin envs --device 7cf02a6

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --verbose, -v

show private environment variables

## <a name="#env-rm-id"></a>env rm &#60;id&#62;

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

device

## <a name="#env-add-key--value"></a>env add &#60;key&#62; [value]

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
	$ resin env add EDITOR vim --device 7cf02a6

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

## <a name="#env-rename-id--value"></a>env rename &#60;id&#62; &#60;value&#62;

Use this command to rename an enviroment variable from an application.

Pass the `--device` boolean option if you want to rename a device environment variable.

Examples:

	$ resin env rename 376 emacs
	$ resin env rename 376 emacs --device

### Options

#### --device, -d

device

# Help

## <a name="#help-command"></a>help [command...]

Get detailed help for an specific command.

Examples:

	$ resin help apps
	$ resin help os download

### Options

#### --verbose, -v

show additional commands

# Information

## <a name="#version"></a>version

Display the Resin CLI version.

# Keys

## <a name="#keys"></a>keys

Use this command to list all your SSH keys.

Examples:

	$ resin keys

## <a name="#key-id"></a>key &#60;id&#62;

Use this command to show information about a single SSH key.

Examples:

	$ resin key 17

## <a name="#key-rm-id"></a>key rm &#60;id&#62;

Use this command to remove a SSH key from resin.io.

Notice this command asks for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Examples:

	$ resin key rm 17
	$ resin key rm 17 --yes

### Options

#### --yes, -y

confirm non interactively

## <a name="#key-add-name--path"></a>key add &#60;name&#62; [path]

Use this command to associate a new SSH key with your account.

If `path` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ resin key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | resin key add Main

# Logs

## <a name="#logs-uuid"></a>logs &#60;uuid&#62;

Use this command to show logs for a specific device.

By default, the command prints all log messages and exit.

To continuously stream output, and see new logs in real time, use the `--tail` option.

Note that for now you need to provide the whole UUID for this command to work correctly.

This is due to some technical limitations that we plan to address soon.

Examples:

	$ resin logs 23c73a1
	$ resin logs 23c73a1

### Options

#### --tail, -t

continuously stream output

# Sync

## <a name="#sync-uuid"></a>sync [uuid]

Warning: 'resin sync' requires an openssh-compatible client and 'rsync' to
be correctly installed in your shell environment. For more information (including
Windows support) please check the README here: https://github.com/resin-io/resin-cli

Use this command to sync your local changes to a certain device on the fly.

After every 'resin sync' the updated settings will be saved in
'<source>/.resin-sync.yml' and will be used in later invocations. You can
also change any option by editing '.resin-sync.yml' directly.

Here is an example '.resin-sync.yml' :

	$ cat $PWD/.resin-sync.yml
	uuid: 7cf02a6
	destination: '/usr/src/app'
	before: 'echo Hello'
	after: 'echo Done'
	ignore:
		- .git
		- node_modules/

Command line options have precedence over the ones saved in '.resin-sync.yml'.

If '.gitignore' is found in the source directory then all explicitly listed files will be
excluded from the syncing process. You can choose to change this default behavior with the
'--skip-gitignore' option.

Examples:

	$ resin sync 7cf02a6 --source . --destination /usr/src/app
	$ resin sync 7cf02a6 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'
	$ resin sync --ignore lib/
	$ resin sync --verbose false
	$ resin sync

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

## <a name="#ssh-uuid"></a>ssh [uuid]

Warning: 'resin ssh' requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check the README here: https://github.com/resin-io/resin-cli

Use this command to get a shell into the running application container of
your device.

Examples:

	$ resin ssh MyApp
	$ resin ssh 7cf02a6
	$ resin ssh 7cf02a6 --port 8080
	$ resin ssh 7cf02a6 -v
	$ resin ssh 7cf02a6 -s

### Options

#### --port, -p &#60;port&#62;

ssh gateway port

#### --verbose, -v

increase verbosity

#### --host, -s

access host OS (for devices with Resin OS >= 2.7.5)

#### --noproxy

don't use the proxy configuration for this connection. Only makes sense if you've configured proxy globally.

# Notes

## <a name="#note-note"></a>note &#60;|note&#62;

Use this command to set or update a device note.

If note command isn't passed, the tool attempts to read from `stdin`.

To view the notes, use $ resin device <uuid>.

Examples:

	$ resin note "My useful note" --device 7cf02a6
	$ cat note.txt | resin note --device 7cf02a6

### Options

#### --device, -d, --dev &#60;device&#62;

device uuid

# OS

## <a name="#os-versions-type"></a>os versions &#60;type&#62;

Use this command to show the available resinOS versions for a certain device type.
Check available types with `resin devices supported`

Example:

	$ resin os versions raspberrypi3

## <a name="#os-download-type"></a>os download &#60;type&#62;

Use this command to download an unconfigured os image for a certain device type.
Check available types with `resin devices supported`

If version is not specified the newest stable (non-pre-release) version of OS
is downloaded if available, or the newest version otherwise (if all existing
versions for the given device type are pre-release).

You can pass `--version menu` to pick the OS version from the interactive menu
of all available versions.

Examples:

	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 1.24.1
	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^1.20.0
	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
	$ resin os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu

### Options

#### --output, -o &#60;output&#62;

output path

#### --version &#60;version&#62;

exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)

## <a name="#os-build-config-image--device-type"></a>os build-config &#60;image&#62; &#60;device-type&#62;

Use this command to prebuild the OS config once and skip the interactive part of `resin os configure`.

Example:

	$ resin os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json
	$ resin os configure ../path/rpi3.img 7cf02a6 --config "$(cat rpi3-config.json)"

### Options

#### --advanced, -v

show advanced configuration options

#### --output, -o &#60;output&#62;

the path to the output JSON file

## <a name="#os-configure-image--uuid--deviceapikey"></a>os configure &#60;image&#62; [uuid] [deviceApiKey]

Use this command to configure a previously downloaded operating system image for
the specific device or for an application generally.

Note that device api keys are only supported on ResinOS 2.0.3+.

This comand still supports the *deprecated* format where the UUID and optionally device key
are passed directly on the command line, but the recommended way is to pass either an --app or
--device argument. The deprecated format will be remove in a future release.

Examples:

	$ resin os configure ../path/rpi.img --device 7cf02a6
	$ resin os configure ../path/rpi.img --device 7cf02a6 --deviceApiKey <existingDeviceKey>
	$ resin os configure ../path/rpi.img --app MyApp

### Options

#### --advanced, -v

show advanced configuration options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --deviceApiKey, -k &#60;device-api-key&#62;

custom device key - note that this is only supported on ResinOS 2.0.3+

#### --config &#60;config&#62;

path to the config JSON file, see `resin os build-config`

## <a name="#os-initialize-image"></a>os initialize &#60;image&#62;

Use this command to initialize a device with previously configured operating system image.

Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.

Examples:

	$ resin os initialize ../path/rpi.img --type 'raspberry-pi'

### Options

#### --yes, -y

confirm non interactively

#### --type, -t &#60;type&#62;

device type (Check available types with `resin devices supported`)

#### --drive, -d &#60;drive&#62;

the drive to write the image to, like `/dev/sdb` or `/dev/mmcblk0`. Careful with this as you can erase your hard drive. Check `resin util available-drives` for available options.

# Config

## <a name="#config-read"></a>config read

Use this command to read the config.json file from the mounted filesystem (e.g. SD card) of a provisioned device"

Examples:

	$ resin config read --type raspberry-pi
	$ resin config read --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `resin devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## <a name="#config-write-key--value"></a>config write &#60;key&#62; &#60;value&#62;

Use this command to write the config.json file to the mounted filesystem (e.g. SD card) of a provisioned device

Examples:

	$ resin config write --type raspberry-pi username johndoe
	$ resin config write --type raspberry-pi --drive /dev/disk2 username johndoe
	$ resin config write --type raspberry-pi files.network/settings "..."

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `resin devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## <a name="#config-inject-file"></a>config inject &#60;file&#62;

Use this command to inject a config.json file to the mounted filesystem
(e.g. SD card or mounted resinOS image) of a provisioned device"

Examples:

	$ resin config inject my/config.json --type raspberry-pi
	$ resin config inject my/config.json --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `resin devices supported`)

#### --drive, -d &#60;drive&#62;

drive

## <a name="#config-reconfigure"></a>config reconfigure

Use this command to reconfigure a provisioned device

Examples:

	$ resin config reconfigure --type raspberry-pi
	$ resin config reconfigure --type raspberry-pi --advanced
	$ resin config reconfigure --type raspberry-pi --drive /dev/disk2

### Options

#### --type, -t &#60;type&#62;

device type (Check available types with `resin devices supported`)

#### --drive, -d &#60;drive&#62;

drive

#### --advanced, -v

show advanced commands

## <a name="#config-generate"></a>config generate

Use this command to generate a config.json for a device or application.

This is interactive by default, but you can do this automatically without interactivity
by specifying an option for each question on the command line, if you know the questions
that will be asked for the relevant device type.

Examples:

	$ resin config generate --device 7cf02a6
	$ resin config generate --device 7cf02a6 --device-api-key <existingDeviceKey>
	$ resin config generate --device 7cf02a6 --output config.json
	$ resin config generate --app MyApp
	$ resin config generate --app MyApp --output config.json
	$ resin config generate --app MyApp --network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 1

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --deviceApiKey, -k &#60;device-api-key&#62;

custom device key - note that this is only supported on ResinOS 2.0.3+

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

## <a name="#preload-image"></a>preload &#60;image&#62;

Warning: "resin preload" requires Docker to be correctly installed in
your shell environment. For more information (including Windows support)
please check the README here: https://github.com/resin-io/resin-cli .

Use this command to preload an application to a local disk image (or
Edison zip archive) with a built release from Resin.io.

Examples:
  $ resin preload resin.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image some-image.png
  $ resin preload resin.img

### Options

#### --app, -a &#60;appId&#62;

id of the application to preload

#### --commit, -c &#60;hash&#62;

the commit hash for a specific application release to preload, use "latest" to specify the latest release
(ignored if no appId is given)

#### --splash-image, -s &#60;splashImage.png&#62;

path to a png image to replace the splash screen

#### --dont-check-device-type

Disables check for matching device types in image and application

#### --docker, -P &#60;docker&#62;

Path to a local docker socket

#### --dockerHost, -h &#60;dockerHost&#62;

The address of the host containing the docker daemon

#### --dockerPort, -p &#60;dockerPort&#62;

The port on which the host docker daemon is listening

#### --ca &#60;ca&#62;

Docker host TLS certificate authority file

#### --cert &#60;cert&#62;

Docker host TLS certificate file

#### --key &#60;key&#62;

Docker host TLS key file

# Settings

## <a name="#settings"></a>settings

Use this command to display detected settings

Examples:

	$ resin settings

# Wizard

## <a name="#quickstart-name"></a>quickstart [name]

Use this command to run a friendly wizard to get started with resin.io.

The wizard will guide you through:

	- Create an application.
	- Initialise an SDCard with the resin.io operating system.
	- Associate an existing project directory with your resin.io application.
	- Push your project to your devices.

Examples:

	$ resin quickstart
	$ resin quickstart MyApp

# Local

## <a name="#local-configure-target"></a>local configure &#60;target&#62;

Use this command to configure or reconfigure a resinOS drive or image.

Examples:

	$ resin local configure /dev/sdc
	$ resin local configure path/to/image.img

## <a name="#local-flash-image"></a>local flash &#60;image&#62;

Use this command to flash a resinOS image to a drive.

Examples:

	$ resin local flash path/to/resinos.img
	$ resin local flash path/to/resinos.img --drive /dev/disk2
	$ resin local flash path/to/resinos.img --drive /dev/disk2 --yes

### Options

#### --yes, -y

confirm non-interactively

#### --drive, -d &#60;drive&#62;

drive

## <a name="#local-logs-deviceip"></a>local logs [deviceIp]


Examples:

	$ resin local logs
	$ resin local logs -f
	$ resin local logs 192.168.1.10
	$ resin local logs 192.168.1.10 -f
	$ resin local logs 192.168.1.10 -f --app-name myapp

### Options

#### --follow, -f

follow log

#### --app-name, -a &#60;name&#62;

name of container to get logs from

## <a name="#local-scan"></a>local scan


Examples:

	$ resin local scan
	$ resin local scan --timeout 120
	$ resin local scan --verbose

### Options

#### --verbose, -v

Display full info

#### --timeout, -t &#60;timeout&#62;

Scan timeout in seconds

## <a name="#local-ssh-deviceip"></a>local ssh [deviceIp]

Warning: 'resin local ssh' requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check the README here: https://github.com/resin-io/resin-cli

Use this command to get a shell into the running application container of
your device.

The '--host' option will get you a shell into the Host OS of the resinOS device.
No option will return a list of containers to enter or you can explicitly select
one by passing its name to the --container option

Examples:

	$ resin local ssh
	$ resin local ssh --host
	$ resin local ssh --container chaotic_water
	$ resin local ssh --container chaotic_water --port 22222
	$ resin local ssh --verbose

### Options

#### --verbose, -v

increase verbosity

#### --host, -s

get a shell into the host OS

#### --container, -c &#60;container&#62;

name of container to access

#### --port, -p &#60;port&#62;

ssh port number (default: 22222)

## <a name="#local-push-deviceip"></a>local push [deviceIp]

Warning: 'resin local push' requires an openssh-compatible client and 'rsync' to
be correctly installed in your shell environment. For more information (including
Windows support) please check the README here: https://github.com/resin-io/resin-cli

Use this command to push your local changes to a container on a LAN-accessible resinOS device on the fly.

If `Dockerfile` or any file in the 'build-triggers' list is changed,
a new container will be built and run on your device.
If not, changes will simply be synced with `rsync` into the application container.

After every 'resin local push' the updated settings will be saved in
'<source>/.resin-sync.yml' and will be used in later invocations. You can
also change any option by editing '.resin-sync.yml' directly.

Here is an example '.resin-sync.yml' :

	$ cat $PWD/.resin-sync.yml
	destination: '/usr/src/app'
	before: 'echo Hello'
	after: 'echo Done'
	ignore:
		- .git
		- node_modules/

Command line options have precedence over the ones saved in '.resin-sync.yml'.

If '.gitignore' is found in the source directory then all explicitly listed files will be
excluded when using rsync to update the container. You can choose to change this default behavior with the
'--skip-gitignore' option.

Examples:

	$ resin local push
	$ resin local push --app-name test-server --build-triggers package.json,requirements.txt
	$ resin local push --force-build
	$ resin local push --force-build --skip-logs
	$ resin local push --ignore lib/
	$ resin local push --verbose false
	$ resin local push 192.168.2.10 --source . --destination /usr/src/app
	$ resin local push 192.168.2.10 -s /home/user/myResinProject -d /usr/src/app --before 'echo Hello' --after 'echo Done'

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

## <a name="#local-stop-deviceip"></a>local stop [deviceIp]


Examples:

	$ resin local stop
	$ resin local stop --app-name myapp
	$ resin local stop --all
	$ resin local stop 192.168.1.10
	$ resin local stop 192.168.1.10 --app-name myapp

### Options

#### --all

stop all containers

#### --app-name, -a &#60;name&#62;

name of container to stop

# Deploy

## <a name="#build-source"></a>build [source]

Use this command to build an image or a complete multicontainer project
with the provided docker daemon.

You must provide either an application or a device-type/architecture
pair to use the resin Dockerfile pre-processor
(e.g. Dockerfile.template -> Dockerfile).

This command will look into the given source directory (or the current working
directory if one isn't specified) for a compose file. If one is found, this
command will build each service defined in the compose file. If a compose file
isn't found, the command will look for a Dockerfile, and if yet that isn't found,
it will try to generate one.

Examples:

	$ resin build
	$ resin build ./source/
	$ resin build --deviceType raspberrypi3 --arch armhf
	$ resin build --application MyApp ./source/
	$ resin build --docker '/var/run/docker.sock'
	$ resin build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem

### Options

#### --arch, -A &#60;arch&#62;

The architecture to build for

#### --deviceType, -d &#60;deviceType&#62;

The type of device this build is for

#### --application, -a &#60;application&#62;

The target resin.io application this build is for

#### --projectName, -n &#60;projectName&#62;

Specify an alternate project name; default is the directory name

#### --emulated, -e

Run an emulated build using Qemu

#### --logs

Display full log output

#### --docker, -P &#60;docker&#62;

Path to a local docker socket

#### --dockerHost, -h &#60;dockerHost&#62;

The address of the host containing the docker daemon

#### --dockerPort, -p &#60;dockerPort&#62;

The port on which the host docker daemon is listening

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

## <a name="#deploy-appname--image"></a>deploy &#60;appName&#62; [image]

Use this command to deploy an image or a complete multicontainer project
to an application, optionally building it first.

Usage: `deploy <appName> ([image] | --build [--source build-dir])`

Unless an image is specified, this command will look into the current directory
(or the one specified by --source) for a compose file. If one is found, this
command will deploy each service defined in the compose file, building it first
if an image for it doesn't exist. If a compose file isn't found, the command
will look for a Dockerfile, and if yet that isn't found, it will try to
generate one.

To deploy to an app on which you're a collaborator, use
`resin deploy <appOwnerUsername>/<appName>`.

Note: If building with this command, all options supported by `resin build`
are also supported with this command.

Examples:

	$ resin deploy myApp
	$ resin deploy myApp --build --source myBuildDir/
	$ resin deploy myApp myApp/myImage

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

#### --logs

Display full log output

#### --docker, -P &#60;docker&#62;

Path to a local docker socket

#### --dockerHost, -h &#60;dockerHost&#62;

The address of the host containing the docker daemon

#### --dockerPort, -p &#60;dockerPort&#62;

The port on which the host docker daemon is listening

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

# Utilities

## <a name="#util-available-drives"></a>util available-drives

Use this command to list your machine's drives usable for writing the OS image to.
Skips the system drives.

