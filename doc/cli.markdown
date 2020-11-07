# balena CLI Documentation

The balena CLI is a Command Line Interface for [balenaCloud](https://www.balena.io/cloud/) or
[openBalena](https://www.balena.io/open/). It is a software tool available for Windows, macOS and
Linux, used through a command prompt / terminal window. It can be used interactively or invoked in
scripts. The balena CLI builds on the [balena API](https://www.balena.io/docs/reference/api/overview/)
and the [balena SDK](https://www.balena.io/docs/reference/sdk/node-sdk/), and can also be directly
imported in Node.js applications. The balena CLI is an [open-source project on
GitHub](https://github.com/balena-io/balena-cli/), and your contribution is also welcome!

## Installation

Check the [balena CLI installation instructions on
GitHub](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).

## Choosing a shell (command prompt/terminal)

On **Windows,** the standard Command Prompt (`cmd.exe`) and
[PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/getting-started/getting-started-with-windows-powershell?view=powershell-6)
are supported. Alternative shells include:

* [MSYS2](https://www.msys2.org/):
  * Install additional packages with the command:  
    `pacman -S git openssh rsync`
  * [Set a Windows environment variable](https://www.onmsft.com/how-to/how-to-set-an-environment-variable-in-windows-10): `MSYS2_PATH_TYPE=inherit`
  * Note that a bug in the MSYS2 launch script (`msys2_shell.cmd`) makes text-based interactive CLI
    menus to break. [Check this Github issue for a
    workaround](https://github.com/msys2/MINGW-packages/issues/1633#issuecomment-240583890).
* [MSYS](http://www.mingw.org/wiki/MSYS): select the `msys-rsync` and `msys-openssh` packages too
* [Git for Windows](https://git-for-windows.github.io/)
  * During the installation, you will be prompted to choose between _"Use MinTTY"_ and _"Use
    Windows' default console window"._ Choose the latter, because of the same [MSYS2
    bug](https://github.com/msys2/MINGW-packages/issues/1633) mentioned above (Git for Windows
    actually uses MSYS2). For a screenshot, check this
    [comment](https://github.com/balena-io/balena-cli/issues/598#issuecomment-556513098).
* Microsoft's [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about)
  (WSL). In this case, a Linux distribution like Ubuntu is installed via the Microsoft Store, and a
  balena CLI release **for Linux** should be selected. See
  [FAQ](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md) for using the
  balena CLI with WSL and Docker Desktop for Windows.

On **macOS** and **Linux,** the standard terminal window is supported. Optionally, `bash` command
auto completion may be enabled by copying the
[balena-completion.bash](https://github.com/balena-io/balena-cli/blob/master/balena-completion.bash)
file to your system's `bash_completion` directory: check [Docker's command completion
guide](https://docs.docker.com/compose/completion/) for system setup instructions.

## Logging in

Several CLI commands require access to your balenaCloud account, for example in order to push a
new release to your application. Those commands require creating a CLI login session by running:

```sh
$ balena login
```

## Proxy support

HTTP(S) proxies can be configured through any of the following methods, in precedence order
(from higher to lower):

* The `BALENARC_PROXY` environment variable in URL format, with protocol (`http` or `https`),
  host, port and optionally basic auth. Examples:
  * `export BALENARC_PROXY='https://bob:secret@proxy.company.com:12345'`
  * `export BALENARC_PROXY='http://localhost:8000'`

* The `proxy` setting in the [CLI config
  file](https://www.npmjs.com/package/balena-settings-client#documentation). It may be:
  * A string in URL format, e.g. `proxy: 'http://localhost:8000'`
  * An object in the format:

    ```yaml
    proxy:
        protocol: 'http'
        host: 'proxy.company.com'
        port: 12345
        proxyAuth: 'bob:secret'
    ```

* The `HTTPS_PROXY` and/or `HTTP_PROXY` environment variables, in the same URL format as
  `BALENARC_PROXY`.

### Proxy setup for balena ssh

In order to work behind a proxy server, the `balena ssh` command requires the
[`proxytunnel`](http://proxytunnel.sourceforge.net/) package (command-line tool) to be installed.
`proxytunnel` is available for Linux distributions like Ubuntu/Debian (`apt install proxytunnel`),
and for macOS through [Homebrew](https://brew.sh/). Windows support is limited to the [Windows
Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (e.g., by installing
Ubuntu through the Microsoft App Store).

Ensure that the proxy server is configured to allow proxy requests to ssh port 22, using
SSL encryption. For example, in the case of the [Squid](http://www.squid-cache.org/) proxy
server, it should be configured with the following rules in the `squid.conf` file:  
`acl SSL_ports port 22`  
`acl Safe_ports port 22`  

### Proxy exclusion

The `BALENARC_NO_PROXY` variable may be used to exclude specified destinations from proxying.

> * This feature requires CLI version 11.30.8 or later. In the case of the npm [installation
>   option](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md), it also requires
>   Node.js version 10.16.0 or later.
> * To exclude a `balena ssh` target from proxying (IP address or `.local` hostname), the
>   `--noproxy` option should be specified in addition to the `BALENARC_NO_PROXY` variable.

By default (if `BALENARC_NO_PROXY` is not defined), all [private IPv4
addresses](https://en.wikipedia.org/wiki/Private_network) and `'*.local'` hostnames are excluded
from proxying. Other hostnames that resolve to private IPv4 addresses are **not** excluded by
default, because matching takes place before name resolution.

`localhost` and `127.0.0.1` are always excluded from proxying, regardless of the value of
BALENARC_NO_PROXY.

The format of the `BALENARC_NO_PROXY` environment variable is a comma-separated list of patterns
that are matched against hostnames or IP addresses. For example:

```
export BALENARC_NO_PROXY='*.local,dev*.mycompany.com,192.168.*'
```

Matched patterns are excluded from proxying. Wildcard expressions are documented at
[matcher](https://www.npmjs.com/package/matcher#usage). Matching takes place _before_ name
resolution, so a pattern like `'192.168.*'` will **not** match a hostname that resolves to an IP
address like `192.168.1.2`.

## Support, FAQ and troubleshooting

To learn more, troubleshoot issues, or to contact us for support:

* Check the [masterclass tutorials](https://www.balena.io/docs/learn/more/masterclasses/overview/)
* Check our [FAQ / troubleshooting document](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md)
* Ask us a question through the [balenaCloud forum](https://forums.balena.io/c/balena-cloud)

For CLI bug reports or feature requests, check the
[CLI GitHub issues](https://github.com/balena-io/balena-cli/issues/).

## Deprecation policy

The balena CLI uses [semver versioning](https://semver.org/), with the concepts
of major, minor and patch version releases.

The latest release of a major version of the balena CLI will remain compatible with
the balenaCloud backend services for at least one year from the date when the
following major version is released. For example, balena CLI v10.17.5, as the
latest v10 release, would remain compatible with the balenaCloud backend for one
year from the date when v11.0.0 is released.

At the end of this period, the older major version is considered deprecated and
some of the functionality that depends on balenaCloud services may stop working
at any time.
Users are encouraged to regularly update the balena CLI to the latest version.


# CLI Command Reference

- API keys

	- [api-key generate &#60;name&#62;](#api-key-generate-name)

- Application

	- [apps](#apps)
	- [app &#60;name&#62;](#app-name)
	- [app create &#60;name&#62;](#app-create-name)
	- [app purge &#60;name&#62;](#app-purge-name)
	- [app rename &#60;name&#62; [newname]](#app-rename-name-newname)
	- [app restart &#60;name&#62;](#app-restart-name)
	- [app rm &#60;name&#62;](#app-rm-name)

- Authentication

	- [login](#login)
	- [logout](#logout)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [devices supported](#devices-supported)
	- [device &#60;uuid&#62;](#device-uuid)
	- [device identify &#60;uuid&#62;](#device-identify-uuid)
	- [device init](#device-init)
	- [device move &#60;uuid(s)&#62;](#device-move-uuid-s)
	- [device os-update &#60;uuid&#62;](#device-os-update-uuid)
	- [device public-url &#60;uuid&#62;](#device-public-url-uuid)
	- [device purge &#60;uuid&#62;](#device-purge-uuid)
	- [device reboot &#60;uuid&#62;](#device-reboot-uuid)
	- [device register &#60;application&#62;](#device-register-application)
	- [device rename &#60;uuid&#62; [newname]](#device-rename-uuid-newname)
	- [device restart &#60;uuid&#62;](#device-restart-uuid)
	- [device rm &#60;uuid(s)&#62;](#device-rm-uuid-s)
	- [device shutdown &#60;uuid&#62;](#device-shutdown-uuid)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-id)
	- [env add &#60;name&#62; [value]](#env-add-name-value)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-id-value)

- Tags

	- [tags](#tags)
	- [tag rm &#60;tagkey&#62;](#tag-rm-tagkey)
	- [tag set &#60;tagkey&#62; [value]](#tag-set-tagkey-value)

- Help and Version

	- [help [command]](#help-command)
	- [version](#version)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-id)
	- [key add &#60;name&#62; [path]](#key-add-name-path)
	- [key rm &#60;id&#62;](#key-rm-id)

- Logs

	- [logs &#60;device&#62;](#logs-device)

- Network

	- [scan](#scan)
	- [ssh &#60;applicationordevice&#62; [service]](#ssh-applicationordevice-service)
	- [tunnel &#60;deviceorapplication&#62;](#tunnel-deviceorapplication)

- Notes

	- [note &#60;|note&#62;](#note-note)

- OS

	- [os versions &#60;type&#62;](#os-versions-type)
	- [os download &#60;type&#62;](#os-download-type)
	- [os build-config &#60;image&#62; &#60;device-type&#62;](#os-build-config-image-device-type)
	- [os configure &#60;image&#62;](#os-configure-image)
	- [os initialize &#60;image&#62;](#os-initialize-image)

- Config

	- [config generate](#config-generate)
	- [config inject &#60;file&#62;](#config-inject-file)
	- [config read](#config-read)
	- [config reconfigure](#config-reconfigure)
	- [config write &#60;key&#62; &#60;value&#62;](#config-write-key-value)

- Preload

	- [preload &#60;image&#62;](#preload-image)

- Push

	- [push &#60;applicationordevice&#62;](#push-applicationordevice)

- Settings

	- [settings](#settings)

- Local

	- [local configure &#60;target&#62;](#local-configure-target)
	- [local flash &#60;image&#62;](#local-flash-image)

- Deploy

	- [build [source]](#build-source)
	- [deploy &#60;appname&#62; [image]](#deploy-appname-image)

- Platform

	- [join [deviceiporhostname]](#join-deviceiporhostname)
	- [leave [deviceiporhostname]](#leave-deviceiporhostname)

- Utilities

	- [util available-drives](#util-available-drives)

- Support

	- [support &#60;action&#62;](#support-action)

# API keys

## api-key generate &#60;name&#62;

Generate a new balenaCloud API key for the current user, with the given
name. The key will be logged to the console.

This key can be used to log into the CLI using 'balena login --token <key>',
or to authenticate requests to the API with an 'Authorization: Bearer <key>' header.

Examples:

	$ balena api-key generate "Jenkins Key"

### Arguments

#### NAME

the API key name

### Options

# Application

## apps

list all your balena applications.

For detailed information on a particular application,
use `balena app <name> instead`.

Examples:

	$ balena apps

### Options

#### -v, --verbose

No-op since release v12.0.0

## app &#60;name&#62;

Display detailed information about a single balena application.

Examples:

	$ balena app MyApp

### Arguments

#### NAME

application name or numeric ID

### Options

## app create &#60;name&#62;

Create a new balena application.

You can specify the application device type with the `--type` option.
Otherwise, an interactive dropdown will be shown for you to select from.

You can see a list of supported device types with:

$ balena devices supported

Examples:

	$ balena app create MyApp
	$ balena app create MyApp --type raspberry-pi

### Arguments

#### NAME

application name

### Options

#### -t, --type TYPE

application device type (Check available types with `balena devices supported`)

## app purge &#60;name&#62;

Purge data from all devices belonging to an application.
This will clear the application's /data directory.

Examples:

	$ balena app purge MyApp

### Arguments

#### NAME

application name or numeric ID

### Options

## app rename &#60;name&#62; [newName]

Rename an application.

Note, if the `newName` parameter is omitted, it will be
prompted for interactively.

Examples:

	$ balena app rename OldName
	$ balena app rename OldName NewName

### Arguments

#### NAME

application name or numeric ID

#### NEWNAME

the new name for the application

### Options

## app restart &#60;name&#62;

Restart all devices belonging to an application.

Examples:

	$ balena app restart MyApp

### Arguments

#### NAME

application name or numeric ID

### Options

## app rm &#60;name&#62;

Permanently remove a balena application.

The --yes option may be used to avoid interactive confirmation.

Examples:

	$ balena app rm MyApp
	$ balena app rm MyApp --yes

### Arguments

#### NAME

application name or numeric ID

### Options

#### -y, --yes

answer "yes" to all questions (non interactive use)

# Authentication

## login

Login to your balena account.

This command will prompt you to login using the following login types:

- Web authorization: open your web browser and prompt to authorize the CLI
from the dashboard.

- Credentials: using email/password and 2FA.

- Token: using a session token or API key from the preferences page.

Examples:

	$ balena login
	$ balena login --web
	$ balena login --token "..."
	$ balena login --credentials
	$ balena login --credentials --email johndoe@gmail.com --password secret

### Arguments

#### TOKEN



### Options

#### -w, --web

web-based login

#### -t, --token

session token or API key

#### -c, --credentials

credential-based login

#### -e, --email EMAIL

email

#### -u, --user USER



#### -p, --password PASSWORD

password

#### -P, --port PORT

TCP port number of local HTTP login server (--web auth only)

## logout

Logout from your balena account.

Examples:

	$ balena logout

## whoami

Get the username and email address of the currently logged in user.

Examples:

	$ balena whoami

# Device

## devices

list all devices that belong to you.

You can filter the devices by application by using the `--application` option.

The --json option is recommended when scripting the output of this command,
because field names are less likely to change in JSON format and because it
better represents data types like arrays, empty strings and null values.
The 'jq' utility may be helpful for querying JSON fields in shell scripts
(https://stedolan.github.io/jq/manual/).

Examples:

	$ balena devices
	$ balena devices --application MyApp
	$ balena devices --app MyApp
	$ balena devices -a MyApp

### Options

#### -a, --application APPLICATION

application name

#### --app APP

same as '--application'

#### -j, --json

produce JSON output instead of tabular output

## devices supported

List the supported device types (like 'raspberrypi3' or 'intel-nuc').

The --verbose option adds extra columns/fields to the output, including the
"STATE" column whose values are one of 'new', 'released' or 'discontinued'.
However, 'discontinued' device types are only listed if the '--discontinued'
option is used.

The --json option is recommended when scripting the output of this command,
because the JSON format is less likely to change and it better represents data
types like lists and empty strings (for example, the ALIASES column contains a
list of zero or more values). The 'jq' utility may be helpful in shell scripts
(https://stedolan.github.io/jq/manual/).

Examples:

	$ balena devices supported
	$ balena devices supported --verbose
	$ balena devices supported -vj

### Options

#### --discontinued

include "discontinued" device types

#### -j, --json

produce JSON output instead of tabular output

#### -v, --verbose

add extra columns in the tabular output (ALIASES, ARCH, STATE)

## device &#60;uuid&#62;

Show information about a single device.

Examples:

	$ balena device 7cf02a6

### Arguments

#### UUID

the device uuid

### Options

## device identify &#60;uuid&#62;

Identify a device by making the ACT LED blink (Raspberry Pi).

Examples:

	$ balena device identify 23c73a1

### Arguments

#### UUID

the uuid of the device to identify

### Options

## device init

Initialise a device by downloading the OS image of a certain application
and writing it to an SD Card.

Note, if the application option is omitted it will be prompted
for interactively.

Examples:

	$ balena device init
	$ balena device init --application MyApp

### Options

#### -a, --application APPLICATION

application name

#### --app APP

same as '--application'

#### -y, --yes

answer "yes" to all questions (non interactive use)

#### -v, --advanced

show advanced configuration options

#### --os-version OS-VERSION

exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)

#### -d, --drive DRIVE

the drive to write the image to, eg. `/dev/sdb` or `/dev/mmcblk0`.
Careful with this as you can erase your hard drive.
Check `balena util available-drives` for available options.

#### --config CONFIG

path to the config JSON file, see `balena os build-config`

## device move &#60;uuid(s)&#62;

Move one or more devices to another application.

Note, if the application option is omitted it will be prompted
for interactively.

Examples:

	$ balena device move 7cf02a6
	$ balena device move 7cf02a6,dc39e52
	$ balena device move 7cf02a6 --application MyNewApp

### Arguments

#### UUID

comma-separated list (no blank spaces) of device UUIDs to be moved

### Options

#### -a, --application APPLICATION

application name

#### --app APP

same as '--application'

## device os-update &#60;uuid&#62;

Start a Host OS update for a device.

Note this command will ask for confirmation interactively.
This can be avoided by passing the `--yes` option.

Requires balenaCloud; will not work with openBalena or standalone balenaOS.

Examples:

	$ balena device os-update 23c73a1
	$ balena device os-update 23c73a1 --version 2.31.0+rev1.prod

### Arguments

#### UUID

the uuid of the device to update

### Options

#### --version VERSION

a balenaOS version

#### -y, --yes

answer "yes" to all questions (non interactive use)

## device public-url &#60;uuid&#62;

This command will output the current public URL for the
specified device.  It can also enable or disable the URL,
or output the enabled status, using the respective options.

The old command style 'balena device public-url enable <uuid>'
is deprecated, but still supported.

Examples:

	$ balena device public-url 23c73a1
	$ balena device public-url 23c73a1 --enable
	$ balena device public-url 23c73a1 --disable
	$ balena device public-url 23c73a1 --status

### Arguments

#### UUID

the uuid of the device to manage

#### LEGACYUUID



### Options

#### --enable

enable the public URL

#### --disable

disable the public URL

#### --status

determine if public URL is enabled

## device purge &#60;uuid&#62;

Purge application data from a device.
This will clear the application's /data directory.

Multiple devices may be specified with a comma-separated list
of values (no spaces).

Examples:

	$ balena device purge 23c73a1
	$ balena device purge 55d43b3,23c73a1

### Arguments

#### UUID

comma-separated list (no blank spaces) of device UUIDs

### Options

## device reboot &#60;uuid&#62;

Remotely reboot a device.

Examples:

	$ balena device reboot 23c73a1

### Arguments

#### UUID

the uuid of the device to reboot

### Options

#### -f, --force

force action if the update lock is set

## device register &#60;application&#62;

Register a device to an application.

Examples:

	$ balena device register MyApp
	$ balena device register MyApp --uuid <uuid>

### Arguments

#### APPLICATION

the name or id of application to register device with

### Options

#### -u, --uuid UUID

custom uuid

## device rename &#60;uuid&#62; [newName]

Rename a device.

Note, if the name is omitted, it will be prompted for interactively.

Examples:

	$ balena device rename 7cf02a6
	$ balena device rename 7cf02a6 MyPi

### Arguments

#### UUID

the uuid of the device to rename

#### NEWNAME

the new name for the device

### Options

## device restart &#60;uuid&#62;

Restart containers on a device.
If the --service flag is provided, then only those services' containers
will be restarted, otherwise all containers on the device will be restarted.

Multiple devices and services may be specified with a comma-separated list
of values (no spaces).

Note this does not reboot the device, to do so use instead `balena device reboot`.

Examples:

	$ balena device restart 23c73a1
	$ balena device restart 55d43b3,23c73a1
	$ balena device restart 23c73a1 --service myService
	$ balena device restart 23c73a1 -s myService1,myService2

### Arguments

#### UUID

comma-separated list (no blank spaces) of device UUIDs to restart

### Options

#### -s, --service SERVICE

comma-separated list (no blank spaces) of service names to restart

## device rm &#60;uuid(s)&#62;

Remove one or more devices from balena.

Note this command asks for confirmation interactively.
You can avoid this by passing the `--yes` option.

Examples:

	$ balena device rm 7cf02a6
	$ balena device rm 7cf02a6,dc39e52
	$ balena device rm 7cf02a6 --yes

### Arguments

#### UUID

comma-separated list (no blank spaces) of device UUIDs to be removed

### Options

#### -y, --yes

answer "yes" to all questions (non interactive use)

## device shutdown &#60;uuid&#62;

Remotely shutdown a device.

Examples:

	$ balena device shutdown 23c73a1

### Arguments

#### UUID

the uuid of the device to shutdown

### Options

#### -f, --force

force action if the update lock is set

# Environment Variables

## envs

List the environment or configuration variables of an application, device or
service, as selected by the respective command-line options. (A service is
an application container in a "microservices" application.)

The results include application-wide (fleet), device-wide (multiple services on
a device) and service-specific variables that apply to the selected application,
device or service. It can be thought of as including "inherited" variables;
for example, a service inherits device-wide variables, and a device inherits
application-wide variables.

The printed output may include DEVICE and/or SERVICE columns to distinguish
between application-wide, device-specific and service-specific variables.
An asterisk in these columns indicates that the variable applies to
"all devices" or "all services".

The --config option is used to list "configuration variables" that control
balena platform features, as opposed to custom environment variables defined
by the user. The --config and the --service options are mutually exclusive
because configuration variables cannot be set for specific services.

The --json option is recommended when scripting the output of this command,
because the JSON format is less likely to change and it better represents data
types like lists and empty strings. The 'jq' utility may be helpful in shell
scripts (https://stedolan.github.io/jq/manual/). When --json is used, an empty
JSON array ([]) is printed instead of an error message when no variables exist
for the given query. When querying variables for a device, note that the
application name may be null in JSON output (or 'N/A' in tabular output) if the
application linked to the device is no longer accessible by the current user
(for example, in case the current user has been removed from the application
by its owner).

Examples:

	$ balena envs --application MyApp
	$ balena envs --application MyApp --json
	$ balena envs --application MyApp --service MyService
	$ balena envs --application MyApp --service MyService
	$ balena envs --application MyApp --config
	$ balena envs --device 7cf02a6
	$ balena envs --device 7cf02a6 --json
	$ balena envs --device 7cf02a6 --config --json
	$ balena envs --device 7cf02a6 --service MyService

### Options

#### --all

No-op since balena CLI v12.0.0.

#### -a, --application APPLICATION

application name

#### -c, --config

show configuration variables only

#### -d, --device DEVICE

device UUID

#### -j, --json

produce JSON output instead of tabular output

#### -v, --verbose

produce verbose output

#### -s, --service SERVICE

service name

## env rm &#60;id&#62;

Remove a configuration or environment variable from an application, device
or service, as selected by command-line options.

Variables are selected by their database ID (as reported by the 'balena envs'
command) and one of six database "resource types":

- application (fleet) environment variable
- application (fleet) configuration variable (--config)
- application (fleet) service variable (--service)
- device environment variable (--device)
- device configuration variable (--device --config)
- device service variable (--device --service)

The --device option selects a device-specific variable instead of an application
(fleet) variable.

The --config option selects a configuration variable. Configuration variable
names typically start with the 'BALENA_' or 'RESIN_' prefixes and are used to
configure balena platform features.

The --service option selects a service variable, which is an environment variable
that applies to a specifc service (application container) in a microservices
(multicontainer) application.

The --service and --config options cannot be used together, but they can be
used alongside the --device option to select a device-specific service or
configuration variable.

Interactive confirmation is normally asked before the variable is deleted.
The --yes option disables this behavior.

Examples:

	$ balena env rm 123123
	$ balena env rm 234234 --yes
	$ balena env rm 345345 --config
	$ balena env rm 456456 --service
	$ balena env rm 567567 --device
	$ balena env rm 678678 --device --config
	$ balena env rm 789789 --device --service --yes

### Arguments

#### ID

variable's numeric database ID

### Options

#### -c, --config

select a configuration variable (may be used together with the --device option)

#### -d, --device

select a device-specific variable instead of an application (fleet) variable

#### -s, --service

select a service variable (may be used together with the --device option)

#### -y, --yes

do not prompt for confirmation before deleting the variable

## env add &#60;name&#62; [value]

Add an environment or config variable to one or more applications, devices
or services, as selected by the respective command-line options. Either the
--application or the --device option must be provided, and either may be be
used alongside the --service option to define a service-specific variable.
(A service is an application container in a "microservices" application.)
When the --service option is used in conjunction with the --device option,
the service variable applies to the selected device only. Otherwise, it
applies to all devices of the selected application (i.e., the application's
fleet). If the --service option is omitted, the variable applies to all
services.

If VALUE is omitted, the CLI will attempt to use the value of the environment
variable of same name in the CLI process' environment. In this case, a warning
message will be printed. Use `--quiet` to suppress it.

'BALENA_' or 'RESIN_' are reserved variable name prefixes used to identify
"configuration variables". Configuration variables control balena platform
features and are treated specially by balenaOS and the balena supervisor
running on devices. They are also stored differently in the balenaCloud API
database. Configuration variables cannot be set for specific services,
therefore the --service option cannot be used when the variable name starts
with a reserved prefix. When defining custom application variables, please
avoid the reserved prefixes.

Examples:

	$ balena env add TERM --application MyApp
	$ balena env add EDITOR vim --application MyApp
	$ balena env add EDITOR vim --application MyApp,MyApp2
	$ balena env add EDITOR vim --application MyApp --service MyService
	$ balena env add EDITOR vim --application MyApp,MyApp2 --service MyService,MyService2
	$ balena env add EDITOR vim --device 7cf02a6
	$ balena env add EDITOR vim --device 7cf02a6,d6f1433
	$ balena env add EDITOR vim --device 7cf02a6 --service MyService
	$ balena env add EDITOR vim --device 7cf02a6,d6f1433 --service MyService,MyService2

### Arguments

#### NAME

environment or config variable name

#### VALUE

variable value; if omitted, use value from this process' environment

### Options

#### -a, --application APPLICATION

application name

#### -d, --device DEVICE

device UUID

#### -q, --quiet

suppress warning messages

#### -s, --service SERVICE

service name

## env rename &#60;id&#62; &#60;value&#62;

Change the value of a configuration or environment variable for an application,
device or service, as selected by command-line options.

Variables are selected by their database ID (as reported by the 'balena envs'
command) and one of six database "resource types":

- application (fleet) environment variable
- application (fleet) configuration variable (--config)
- application (fleet) service variable (--service)
- device environment variable (--device)
- device configuration variable (--device --config)
- device service variable (--device --service)

The --device option selects a device-specific variable instead of an application
(fleet) variable.

The --config option selects a configuration variable. Configuration variable
names typically start with the 'BALENA_' or 'RESIN_' prefixes and are used to
configure balena platform features.

The --service option selects a service variable, which is an environment variable
that applies to a specifc service (application container) in a microservices
(multicontainer) application.

The --service and --config options cannot be used together, but they can be
used alongside the --device option to select a device-specific service or
configuration variable.

Examples:

	$ balena env rename 123123 emacs
	$ balena env rename 234234 emacs --service
	$ balena env rename 345345 emacs --device
	$ balena env rename 456456 emacs --device --service
	$ balena env rename 567567 1 --config
	$ balena env rename 678678 1 --device --config

### Arguments

#### ID

variable's numeric database ID

#### VALUE

variable value; if omitted, use value from this process' environment

### Options

#### -c, --config

select a configuration variable (may be used together with the --device option)

#### -d, --device

select a device-specific variable instead of an application (fleet) variable

#### -s, --service

select a service variable (may be used together with the --device option)

# Tags

## tags

List all tags and their values for a particular application,
device or release.

Examples:

	$ balena tags --application MyApp
	$ balena tags --device 7cf02a6
	$ balena tags --release 1234
	$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6

### Options

#### -a, --application APPLICATION

application name

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

#### --app APP

same as '--application'

## tag rm &#60;tagKey&#62;

Remove a tag from an application, device or release.

Examples:

	$ balena tag rm myTagKey --application MyApp
	$ balena tag rm myTagKey --device 7cf02a6
	$ balena tag rm myTagKey --release 1234
	$ balena tag rm myTagKey --release b376b0e544e9429483b656490e5b9443b4349bd6

### Arguments

#### TAGKEY

the key string of the tag

### Options

#### -a, --application APPLICATION

application name

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

#### --app APP

same as '--application'

## tag set &#60;tagKey&#62; [value]

Set a tag on an application, device or release.

You can optionally provide a value to be associated with the created
tag, as an extra argument after the tag key. If a value isn't
provided, a tag with an empty value is created.

Examples:

	$ balena tag set mySimpleTag --application MyApp
	$ balena tag set myCompositeTag myTagValue --application MyApp
	$ balena tag set myCompositeTag myTagValue --device 7cf02a6
	$ balena tag set myCompositeTag "my tag value with whitespaces" --device 7cf02a6
	$ balena tag set myCompositeTag myTagValue --release 1234
	$ balena tag set myCompositeTag --release 1234
	$ balena tag set myCompositeTag --release b376b0e544e9429483b656490e5b9443b4349bd6

### Arguments

#### TAGKEY

the key string of the tag

#### VALUE

the optional value associated with the tag

### Options

#### -a, --application APPLICATION

application name

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

#### --app APP

same as '--application'

# Help and Version

## help [command]

List balena commands, or get detailed help for a specific command.

Examples:

	$ balena help
	$ balena help apps
	$ balena help os download

### Arguments

#### COMMAND

command to show help for

### Options

#### --v, --verbose

show additional commands

## version

Display version information for the balena CLI and/or Node.js. Note that the
balena CLI executable installers for Windows and macOS, and the standalone
zip packages, ship with a built-in copy of Node.js.  In this case, the
reported version of Node.js regards this built-in copy, rather than any
other `node` engine that may also be available on the command prompt.

The --json option is recommended when scripting the output of this command,
because the JSON format is less likely to change and it better represents
data types like lists and empty strings. The 'jq' utility may be helpful
in shell scripts (https://stedolan.github.io/jq/manual/).

This command can also be invoked with 'balena --version' or 'balena -v'.

Examples:

	$ balena version
	$ balena version -a
	$ balena version -j
	$ balena --version
	$ balena -v

### Options

#### -a, --all

include version information for additional components (Node.js)

#### -j, --json

output version information in JSON format for programmatic use

# Keys

## keys

List all SSH keys registered in balenaCloud for the logged in user.

Examples:

	$ balena keys

### Options

## key &#60;id&#62;

Display a single SSH key registered in balenaCloud for the logged in user.

Examples:

	$ balena key 17

### Arguments

#### ID

balenaCloud ID for the SSH key

### Options

## key add &#60;name&#62; [path]

Add an SSH key to the balenaCloud account of the logged in user.

If `path` is omitted, the command will attempt to read the SSH key from stdin.

About SSH keys  
An "SSH key" actually consists of a public/private key pair. A typical name
for the private key file is "id_rsa", and a typical name for the public key
file is "id_rsa.pub". Both key files are saved to your computer (with the
private key optionally protected by a password), but only the public key is
saved to your balena account.  This means that if you change computers or
otherwise lose the private key, you cannot recover the private key through
your balena account. You can however add new keys, and delete the old ones.

To generate a new SSH key pair, a nice guide can be found in GitHub's docs:
https://help.github.com/en/articles/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent
Skip the step about adding the key to a GitHub account, and instead add it to
your balena account.

Examples:

	$ balena key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | balena key add Main
	# Windows 10 (cmd.exe prompt) example
	$ balena key add Main %userprofile%.sshid_rsa.pub

### Arguments

#### NAME

the SSH key name

#### PATH

the path to the public key file

### Options

## key rm &#60;id&#62;

Remove a single SSH key registered in balenaCloud for the logged in user.

The --yes option may be used to avoid interactive confirmation.

Examples:

	$ balena key rm 17
	$ balena key rm 17 --yes

### Arguments

#### ID

balenaCloud ID for the SSH key

### Options

#### -y, --yes

answer "yes" to all questions (non interactive use)

# Logs

## logs &#60;device&#62;

Show logs for a specific device.

By default, the command prints all log messages and exits.

To continuously stream output, and see new logs in real time, use the `--tail` option.

If an IP or .local address is passed to this command, logs are displayed from
a local mode device with that address. Note that --tail is implied
when this command is provided a local mode device.

Logs from a single service can be displayed with the --service flag. Just system logs
can be shown with the --system flag. Note that these flags can be used together.

Note: --service and --system flags must come after the device parameter, as per examples.

Examples:

	$ balena logs 23c73a1
	$ balena logs 23c73a1 --tail
	
	$ balena logs 192.168.0.31
	$ balena logs 192.168.0.31 --service my-service
	$ balena logs 192.168.0.31 --service my-service-1 --service my-service-2
	
	$ balena logs 23c73a1.local --system
	$ balena logs 23c73a1.local --system --service my-service

### Arguments

#### DEVICE

device UUID, IP, or .local address

### Options

#### --max-retry MAX-RETRY

Maximum number of reconnection attempts on "connection lost" errors
(use 0 to disable auto reconnection).

#### -t, --tail

continuously stream output

#### -s, --service SERVICE

Reject logs not originating from this service.
This can be used in combination with --system or other --service flags.

#### -S, --system

Only show system logs. This can be used in combination with --service.

# Network

## scan

Scan for balenaOS devices on your local network.

The output includes device information collected through balenaEngine for
devices running a development image of balenaOS. Devices running a production
image do not expose balenaEngine (on TCP port 2375), which is why less
information is printed about them.

Examples:

	$ balena scan
	$ balena scan --timeout 120
	$ balena scan --verbose

### Options

#### -v, --verbose

display full info

#### -t, --timeout TIMEOUT

scan timeout in seconds

#### -j, --json

produce JSON output instead of tabular output

## ssh &#60;applicationOrDevice&#62; [service]

Start a shell on a local or remote device. If a service name is not provided,
a shell will be opened on the host OS.

If an application name is provided, an interactive menu will be presented
for the selection of an online device. A shell will then be opened for the
host OS or service container of the chosen device.

For local devices, the IP address and .local domain name are supported.
If the device is referenced by IP or `.local` address, the connection
is initiated directly to balenaOS on port `22222` via an
openssh-compatible client. Otherwise, any connection initiated remotely
traverses the balenaCloud VPN.

Commands may be piped to the standard input for remote execution (see examples).
Note however that remote command execution on service containers (as opposed to
the host OS) is not currently possible when a device UUID is used (instead of
an IP address) because of a balenaCloud backend limitation.

Note: `balena ssh` requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check:
	https://github.com/balena-io/balena-cli/blob/master/INSTALL.md#additional-dependencies,

Examples:

	$ balena ssh MyApp
	$ balena ssh f49cefd
	$ balena ssh f49cefd my-service
	$ balena ssh f49cefd --port <port>
	$ balena ssh 192.168.0.1 --verbose
	$ balena ssh f49cefd.local my-service
	$ echo "uptime; exit;" | balena ssh f49cefd
	$ echo "uptime; exit;" | balena ssh 192.168.0.1 myService

### Arguments

#### APPLICATIONORDEVICE

application name, device uuid, or address of local device

#### SERVICE

service name, if connecting to a container

### Options

#### -p, --port PORT

SSH server port number (default 22222) if the target is an IP address or .local
hostname. Otherwise, port number for the balenaCloud gateway (default 22).

#### -t, --tty

Force pseudo-terminal allocation (bypass TTY autodetection for stdin)

#### -v, --verbose

Increase verbosity

#### --noproxy

Bypass global proxy configuration for the ssh connection

## tunnel &#60;deviceOrApplication&#62;

Use this command to open local ports which tunnel to listening ports on your balenaOS device.

For example, you could open port 8080 on your local machine to connect to your managed balenaOS
device running a web server listening on port 3000.

Port mappings are specified in the format: <remotePort>[:[localIP:]localPort]
localIP defaults to 'localhost', and localPort defaults to the specified remotePort value.

You can tunnel multiple ports at any given time.

Note: Port mappings must come after the deviceOrApplication parameter, as per examples.

Examples:

	# map remote port 22222 to localhost:22222
	$ balena tunnel myApp -p 22222
	
	# map remote port 22222 to localhost:222
	$ balena tunnel 2ead211 -p 22222:222
	
	# map remote port 22222 to any address on your host machine, port 22222
	$ balena tunnel 1546690 -p 22222:0.0.0.0
	
	# map remote port 22222 to any address on your host machine, port 222
	$ balena tunnel myApp -p 22222:0.0.0.0:222
	
	# multiple port tunnels can be specified at any one time
	$ balena tunnel myApp -p 8080:3000 -p 8081:9000

### Arguments

#### DEVICEORAPPLICATION

device uuid or application name/id

### Options

#### -p, --port PORT

port mapping in the format <remotePort>[:[localIP:]localPort]

# Notes

## note &#60;|note&#62;

Set or update a device note. If the note argument is not provided,
it will be read from stdin.

To view device notes, use the `balena device <uuid>` command.

Examples:

	$ balena note "My useful note" --device 7cf02a6
	$ cat note.txt | balena note --device 7cf02a6

### Arguments

#### NOTE

note content

### Options

#### -d, --device DEVICE

device UUID

#### --dev DEV



# OS

## os versions &#60;type&#62;

Show the available balenaOS versions for the given device type.
Check available types with `balena devices supported`.

Examples:

	$ balena os versions raspberrypi3

### Arguments

#### TYPE

device type

### Options

## os download &#60;type&#62;

Download an unconfigured OS image for a certain device type.
Check available types with `balena devices supported`

Note: Currently this command only works with balenaCloud, not openBalena.
If using openBalena, please download the OS from: https://www.balena.io/os/

If version is not specified the newest stable (non-pre-release) version of OS
is downloaded (if available), otherwise the newest version (if all existing
versions for the given device type are pre-release).

You can pass `--version menu` to pick the OS version from the interactive menu
of all available versions.

To download a development image append `.dev` to the version or select from
the interactive menu.

Examples:

	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1.dev
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^2.60.0
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu

### Arguments

#### TYPE

the device type

### Options

#### -o, --output OUTPUT

output path

#### --version VERSION

exact version number, or a valid semver range,
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one stable version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (will show the interactive menu)

## os build-config &#60;image&#62; &#60;device-type&#62;

Interactively generate an OS config once, so that the generated config
file can be used in `balena os configure`, skipping the interactive part.

Examples:

	$ balena os build-config ../path/rpi3.img raspberrypi3 --output rpi3-config.json
	$ balena os configure ../path/rpi3.img --device 7cf02a6 --config rpi3-config.json

### Arguments

#### IMAGE

os image

#### DEVICE-TYPE

device type

### Options

#### -v, --advanced

show advanced configuration options

#### -o, --output OUTPUT

path to output JSON file

## os configure &#60;image&#62;

Configure a previously downloaded balenaOS image for a specific device type or
balena application.

Configuration settings such as WiFi authentication will be taken from the
following sources, in precedence order:
1. Command-line options like `--config-wifi-ssid`
2. A given `config.json` file specified with the `--config` option.
3. User input through interactive prompts (text menus).

The --device-type option may be used to override the application's default
device type, in case of an application with mixed device types.

The --system-connection (-c) option can be used to inject NetworkManager connection
profiles for additional network interfaces, such as cellular/GSM or additional
WiFi or ethernet connections. This option may be passed multiple times in case there
are multiple files to inject. See connection profile examples and reference at:
https://www.balena.io/docs/reference/OS/network/2.x/
https://developer.gnome.org/NetworkManager/stable/nm-settings.html

The --device-api-key option is deprecated and will be removed in a future release.
A suitable key is automatically generated or fetched if this option is omitted.

Note: This command is currently not supported on Windows natively. Windows users
are advised to install the Windows Subsystem for Linux (WSL) with Ubuntu, and use
the Linux release of the balena CLI:
https://docs.microsoft.com/en-us/windows/wsl/about

Examples:

	$ balena os configure ../path/rpi3.img --device 7cf02a6
	$ balena os configure ../path/rpi3.img --device 7cf02a6 --device-api-key <existingDeviceKey>
	$ balena os configure ../path/rpi3.img --app MyApp
	$ balena os configure ../path/rpi3.img --app MyApp --version 2.12.7
	$ balena os configure ../path/rpi3.img --app MyFinApp --device-type raspberrypi3
	$ balena os configure ../path/rpi3.img --app MyFinApp --device-type raspberrypi3 --config myWifiConfig.json

### Arguments

#### IMAGE

path to a balenaOS image file, e.g. "rpi3.img"

### Options

#### -v, --advanced

ask advanced configuration questions (when in interactive mode)

#### --app APP

same as '--application'

#### -a, --application APPLICATION

application name

#### --config CONFIG

path to a pre-generated config.json file to be injected in the OS image

#### --config-app-update-poll-interval CONFIG-APP-UPDATE-POLL-INTERVAL

interval (in minutes) for the on-device balena supervisor periodic app update check

#### --config-network CONFIG-NETWORK

device network type (non-interactive configuration)

#### --config-wifi-key CONFIG-WIFI-KEY

WiFi key (password) (non-interactive configuration)

#### --config-wifi-ssid CONFIG-WIFI-SSID

WiFi SSID (network name) (non-interactive configuration)

#### -d, --device DEVICE

device UUID

#### -k, --device-api-key DEVICE-API-KEY

custom device API key (DEPRECATED and only supported with balenaOS 2.0.3+)

#### --device-type DEVICE-TYPE

device type slug (e.g. "raspberrypi3") to override the application device type

#### --initial-device-name INITIAL-DEVICE-NAME

This option will set the device name when the device provisions

#### --version VERSION

balenaOS version, for example "2.32.0" or "2.44.0+rev1"

#### -c, --system-connection SYSTEM-CONNECTION

paths to local files to place into the 'system-connections' directory

## os initialize &#60;image&#62;

Initialize an os image for a device with a previously
		configured operating system image.
		

Note: Initializing the device may ask for administrative permissions
because we need to access the raw devices directly.

Examples:

	$ balena os initialize ../path/rpi.img --type raspberry-pi

### Arguments

#### IMAGE

path to OS image

### Options

#### -t, --type TYPE

device type (Check available types with `balena devices supported`)

#### -d, --drive DRIVE

the drive to write the image to, eg. `/dev/sdb` or `/dev/mmcblk0`.
Careful with this as you can erase your hard drive.
Check `balena util available-drives` for available options.

#### -y, --yes

answer "yes" to all questions (non interactive use)

# Config

## config generate

Generate a config.json file for a device or application.

Calling this command with the exact version number of the targeted image is required.

This command is interactive by default, but you can do this automatically without interactivity
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

#### --version VERSION

a balenaOS version

#### -a, --application APPLICATION

application name

#### --app APP

same as '--application'

#### -d, --device DEVICE

device uuid

#### -k, --deviceApiKey DEVICEAPIKEY

custom device key - note that this is only supported on balenaOS 2.0.3+

#### --deviceType DEVICETYPE

device type slug

#### --generate-device-api-key

generate a fresh device key for the device

#### -o, --output OUTPUT

path of output file

#### --network NETWORK

the network type to use: ethernet or wifi

#### --wifiSsid WIFISSID

the wifi ssid to use (used only if --network is set to wifi)

#### --wifiKey WIFIKEY

the wifi key to use (used only if --network is set to wifi)

#### --appUpdatePollInterval APPUPDATEPOLLINTERVAL

how frequently (in minutes) to poll for application updates

## config inject &#60;file&#62;

Inject a config.json file to the mounted filesystem,
e.g. the SD card of a provisioned device or balenaOS image.

Examples:

	$ balena config inject my/config.json --type raspberrypi3
	$ balena config inject my/config.json --type raspberrypi3 --drive /dev/disk2

### Arguments

#### FILE

the path to the config.json file to inject

### Options

#### -t, --type TYPE

device type (Check available types with `balena devices supported`)

#### -d, --drive DRIVE

device filesystem or OS image location

## config read

Read the config.json file from the mounted filesystem,
e.g. the SD card of a provisioned device or balenaOS image.

Examples:

	$ balena config read --type raspberrypi3
	$ balena config read --type raspberrypi3 --drive /dev/disk2

### Options

#### -t, --type TYPE

device type (Check available types with `balena devices supported`)

#### -d, --drive DRIVE

device filesystem or OS image location

## config reconfigure

Interactively reconfigure a provisioned device or OS image.

Examples:

	$ balena config reconfigure --type raspberrypi3
	$ balena config reconfigure --type raspberrypi3 --advanced
	$ balena config reconfigure --type raspberrypi3 --drive /dev/disk2

### Options

#### -t, --type TYPE

device type (Check available types with `balena devices supported`)

#### -d, --drive DRIVE

device filesystem or OS image location

#### -v, --advanced

show advanced commands

## config write &#60;key&#62; &#60;value&#62;

Write a key-value pair to the config.json file on the mounted filesystem,
e.g. the SD card of a provisioned device or balenaOS image.

Examples:

	$ balena config write --type raspberrypi3 username johndoe
	$ balena config write --type raspberrypi3 --drive /dev/disk2 username johndoe
	$ balena config write --type raspberrypi3 files.network/settings "..."

### Arguments

#### KEY

the key of the config parameter to write

#### VALUE

the value of the config parameter to write

### Options

#### -t, --type TYPE

device type (Check available types with `balena devices supported`)

#### -d, --drive DRIVE

device filesystem or OS image location

# Preload

## preload &#60;image&#62;

Preload a balena application release (app images/containers), and optionally
a balenaOS splash screen, in a previously downloaded '.img' balenaOS image file
in the local disk (a zip file is only accepted for the Intel Edison device type).
After preloading, the balenaOS image file can be flashed to a device's SD card.
When the device boots, it will not need to download the application, as it was
preloaded.

Warning: "balena preload" requires Docker to be correctly installed in
your shell environment. For more information (including Windows support)
check: https://github.com/balena-io/balena-cli/blob/master/INSTALL.md

Examples:

	$ balena preload balena.img --app 1234 --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0 --splash-image image.png
	$ balena preload balena.img

### Arguments

#### IMAGE

the image file path

### Options

#### -a, --app APP

name of the application to preload

#### -c, --commit COMMIT

The commit hash for a specific application release to preload, use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the latest, but can be
manually pinned using https://github.com/balena-io-projects/staged-releases .

#### -s, --splash-image SPLASH-IMAGE

path to a png image to replace the splash screen

#### --dont-check-arch

disables check for matching architecture in image and application

#### -p, --pin-device-to-release

pin the preloaded device to the preloaded release on provision

#### --add-certificate ADD-CERTIFICATE

Add the given certificate (in PEM format) to /etc/ssl/certs in the preloading container.
The file name must end with '.crt' and must not be already contained in the preloader's
/etc/ssl/certs folder.
Can be repeated to add multiple certificates.

#### -P, --docker DOCKER

Path to a local docker socket (e.g. /var/run/docker.sock)

#### -h, --dockerHost DOCKERHOST

Docker daemon hostname or IP address (dev machine or balena device) 

#### --dockerPort DOCKERPORT

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca CA

Docker host TLS certificate authority file

#### --cert CERT

Docker host TLS certificate file

#### --key KEY

Docker host TLS key file

# Push

## push &#60;applicationOrDevice&#62;

Start a build on the remote balenaCloud builders, or a local mode balena device.

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

When pushing to a local device a live session will be started.
The project source folder is watched for filesystem events, and changes
to files and folders are automatically synchronized to the running
containers. The synchronization is only in one direction, from this machine to
the device, and changes made on the device itself may be overwritten.
This feature requires a device running supervisor version v9.7.0 or greater.

REGISTRY SECRETS  
The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:
```
	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'
```
For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-examples/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

DOCKERIGNORE AND GITIGNORE FILES  
By default, the balena CLI will use a single ".dockerignore" file (if any) at
the project root (--source directory) in order to decide which source files to
exclude from the "build context" (tar stream) sent to balenaCloud, Docker
daemon or balenaEngine. In a microservices (multicontainer) application, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) applications that define a docker-compose.yml file. When
this option is used, each service subdirectory (defined by the `build` or
`build.context` service properties in the docker-compose.yml file) is
filtered separately according to a .dockerignore file defined in the service
subdirectory. If no .dockerignore file exists in a service subdirectory, then
only the default .dockerignore patterns (see below) apply for that service
subdirectory.

When the --multi-dockerignore (-m) option is used, the .dockerignore file (if
any) defined at the overall project root will be used to filter files and
subdirectories other than service subdirectories. It will not have any effect
on service subdirectories, whether or not a service subdirectory defines its
own .dockerignore file. Multiple .dockerignore files are not merged or added
together, and cannot override or extend other files. This behavior maximises
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI releases older than v12.0.0 also took .gitignore files into account.
This behavior is deprecated, but may still be enabled with the --gitignore (-g)
option if compatibility is required. This option is mutually exclusive with
--multi-dockerignore (-m) and will be removed in the CLI's next major version
release (v13).

Default .dockerignore patterns  
When --gitignore (-g) is NOT used (i.e. when not in v11 compatibility mode), a
few default/hardcoded dockerignore patterns are "merged" (in memory) with the
patterns found in the applicable .dockerignore files, in the following order:
```
    **/.git
    < user's patterns from the applicable '.dockerignore' file, if any >
    !**/.balena
    !**/.resin
    !**/Dockerfile
    !**/Dockerfile.*
    !**/docker-compose.yml
```
These patterns always apply, whether or not .dockerignore files exist in the
project. If necessary, the effect of the `**/.git` pattern may be modified by
adding counter patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Note: the --service and --env flags must come after the applicationOrDevice
parameter, as per examples.

Examples:

	$ balena push myApp
	$ balena push myApp --source <source directory>
	$ balena push myApp -s <source directory>
	
	$ balena push 10.0.0.1
	$ balena push 10.0.0.1 --source <source directory>
	$ balena push 10.0.0.1 --service my-service
	$ balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value
	$ balena push 10.0.0.1 --nolive
	
	$ balena push 23c73a1.local --system
	$ balena push 23c73a1.local --system --service my-service

### Arguments

#### APPLICATIONORDEVICE

application name, or device address (for local pushes)

### Options

#### -s, --source SOURCE

Source directory to be sent to balenaCloud or balenaOS device
(default: current working dir)

#### -e, --emulated

Don't use native ARM servers; force QEMU ARM emulation on Intel x86-64
servers during the image build (balenaCloud).

#### --dockerfile DOCKERFILE

Alternative Dockerfile name/path, relative to the source folder

#### -c, --nocache

Don't use cached layers of previously built images for this project. This
ensures that the latest base image and packages are pulled. Note that build
logs may still display the message _"Pulling previous images for caching
purposes" (as the cloud builder needs previous images to compute delta
updates), but the logs will not display the "Using cache" lines for each
build step of a Dockerfile.

#### --pull

When pushing to a local device, force the base images to be pulled again.
Currently this option is ignored when pushing to the balenaCloud builders.

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### -R, --registry-secrets REGISTRY-SECRETS

Path to a local YAML or JSON file containing Docker registry passwords used
to pull base images. Note that if registry-secrets are not provided on the
command line, a secrets configuration file from the balena directory will be
used (usually $HOME/.balena/secrets.yml|.json)

#### --nolive

Don't run a live session on this push. The filesystem will not be monitored,
and changes will not be synchronized to any running containers. Note that both
this flag and --detached and required to cause the process to end once the
initial build has completed.

#### -d, --detached

When pushing to the cloud, this option will cause the build to start, then
return execution back to the shell, with the status and release ID (if
applicable).  When pushing to a local mode device, this option will cause
the command to not tail application logs when the build has completed.

#### --service SERVICE

Reject logs not originating from this service.
This can be used in combination with --system and other --service flags.
Only valid when pushing to a local mode device.

#### --system

Only show system logs. This can be used in combination with --service.
Only valid when pushing to a local mode device.

#### --env ENV

When performing a push to device, run the built containers with environment
variables provided with this argument. Environment variables can be applied
to individual services by adding their service name before the argument,
separated by a colon, e.g:
	--env main:MY_ENV=value
Note that if the service name cannot be found in the composition, the entire
left hand side of the = character will be treated as the variable name.

#### -l, --convert-eol

No-op and deprecated since balena CLI v12.0.0

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help push".

#### -G, --nogitignore

No-op (default behavior) since balena CLI v12.0.0. See "balena help push".

#### -g, --gitignore

Consider .gitignore files in addition to the .dockerignore file. This reverts
to the CLI v11 behavior/implementation (deprecated) if compatibility is
required until your project can be adapted.

# Settings

## settings

Use this command to display the current balena CLI settings.

Examples:

	$ balena settings

### Options

# Local

## local configure &#60;target&#62;

Configure or reconfigure a balenaOS drive or image.

Examples:

	$ balena local configure /dev/sdc
	$ balena local configure path/to/image.img

### Arguments

#### TARGET

path of drive or image to configure

### Options

## local flash &#60;image&#62;

Flash a balenaOS image to a drive.
Image file may be one of: .img|.zip|.gz|.bz2|.xz

If --drive is not specified, then it will interactively
show a list of available drives for selection.

Examples:

	$ balena local flash path/to/balenaos.img
	$ balena local flash path/to/balenaos.img --drive /dev/disk2
	$ balena local flash path/to/balenaos.img --drive /dev/disk2 --yes

### Arguments

#### IMAGE

path to OS image

### Options

#### -d, --drive DRIVE

the drive to write the image to, eg. `/dev/sdb` or `/dev/mmcblk0`.
Careful with this as you can erase your hard drive.
Check `balena util available-drives` for available options.

#### -y, --yes

answer "yes" to all questions (non interactive use)

# Deploy

## build [source]

Use this command to build an image or a complete multicontainer project with
the provided docker daemon in your development machine or balena device.
(See also the `balena push` command for the option of building images in the
balenaCloud build servers.)

You must provide either an application or a device-type/architecture pair.

This command will look into the given source directory (or the current working
directory if one isn't specified) for a docker-compose.yml file, and if found,
each service defined in the compose file will be built. If a compose file isn't
found, it will look for a Dockerfile[.template] file (or alternative Dockerfile
specified with the `--dockerfile` option), and if no dockerfile is found, it
will try to generate one.

REGISTRY SECRETS  
The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:
```
	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'
```
For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-examples/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

DOCKERIGNORE AND GITIGNORE FILES  
By default, the balena CLI will use a single ".dockerignore" file (if any) at
the project root (--source directory) in order to decide which source files to
exclude from the "build context" (tar stream) sent to balenaCloud, Docker
daemon or balenaEngine. In a microservices (multicontainer) application, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) applications that define a docker-compose.yml file. When
this option is used, each service subdirectory (defined by the `build` or
`build.context` service properties in the docker-compose.yml file) is
filtered separately according to a .dockerignore file defined in the service
subdirectory. If no .dockerignore file exists in a service subdirectory, then
only the default .dockerignore patterns (see below) apply for that service
subdirectory.

When the --multi-dockerignore (-m) option is used, the .dockerignore file (if
any) defined at the overall project root will be used to filter files and
subdirectories other than service subdirectories. It will not have any effect
on service subdirectories, whether or not a service subdirectory defines its
own .dockerignore file. Multiple .dockerignore files are not merged or added
together, and cannot override or extend other files. This behavior maximises
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI releases older than v12.0.0 also took .gitignore files into account.
This behavior is deprecated, but may still be enabled with the --gitignore (-g)
option if compatibility is required. This option is mutually exclusive with
--multi-dockerignore (-m) and will be removed in the CLI's next major version
release (v13).

Default .dockerignore patterns  
When --gitignore (-g) is NOT used (i.e. when not in v11 compatibility mode), a
few default/hardcoded dockerignore patterns are "merged" (in memory) with the
patterns found in the applicable .dockerignore files, in the following order:
```
    **/.git
    < user's patterns from the applicable '.dockerignore' file, if any >
    !**/.balena
    !**/.resin
    !**/Dockerfile
    !**/Dockerfile.*
    !**/docker-compose.yml
```
These patterns always apply, whether or not .dockerignore files exist in the
project. If necessary, the effect of the `**/.git` pattern may be modified by
adding counter patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Examples:

	$ balena build --application myApp
	$ balena build ./source/ --application myApp
	$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated
	$ balena build --docker /var/run/docker.sock --application myApp   # Linux, Mac
	$ balena build --docker //./pipe/docker_engine --application myApp # Windows
	$ balena build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem -a myApp

### Arguments

#### SOURCE

path of project source directory

### Options

#### -A, --arch ARCH

the architecture to build for

#### -d, --deviceType DEVICETYPE

the type of device this build is for

#### -a, --application APPLICATION

name of the target balena application this build is for

#### -e, --emulated

Use QEMU for ARM architecture emulation during the image build

#### --dockerfile DOCKERFILE

Alternative Dockerfile name/path, relative to the source folder

#### --logs

No-op and deprecated since balena CLI v12.0.0. Build logs are now shown by default.

#### --nologs

Hide the image build log output (produce less verbose output)

#### -g, --gitignore

Consider .gitignore files in addition to the .dockerignore file. This reverts
to the CLI v11 behavior/implementation (deprecated) if compatibility is required
until your project can be adapted.

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help build".

#### -G, --nogitignore

No-op (default behavior) since balena CLI v12.0.0. See "balena help build".

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### -R, --registry-secrets REGISTRY-SECRETS

Path to a YAML or JSON file with passwords for a private Docker registry

#### -l, --convert-eol

No-op and deprecated since balena CLI v12.0.0

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -n, --projectName PROJECTNAME

Specify an alternate project name; default is the directory name

#### -t, --tag TAG

The alias to the generated image

#### -B, --buildArg BUILDARG

Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

#### --cache-from CACHE-FROM

Comma-separated list (no spaces) of image names for build cache resolution. Implements the same feature as the "docker build --cache-from" option.

#### --nocache

Don't use docker layer caching when building

#### --pull

Pull the base images again even if they exist locally

#### --squash

Squash newly built layers into a single new layer

#### -P, --docker DOCKER

Path to a local docker socket (e.g. /var/run/docker.sock)

#### -h, --dockerHost DOCKERHOST

Docker daemon hostname or IP address (dev machine or balena device) 

#### -p, --dockerPort DOCKERPORT

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca CA

Docker host TLS certificate authority file

#### --cert CERT

Docker host TLS certificate file

#### --key KEY

Docker host TLS key file

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

REGISTRY SECRETS  
The --registry-secrets option specifies a JSON or YAML file containing private
Docker registry usernames and passwords to be used when pulling base images.
Sample registry-secrets YAML file:
```
	'my-registry-server.com:25000':
		username: ann
		password: hunter2
	'':  # Use the empty string to refer to the Docker Hub
		username: mike
		password: cze14
	'eu.gcr.io':  # Google Container Registry
		username: '_json_key'
		password: '{escaped contents of the GCR keyfile.json file}'
```
For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-examples/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

DOCKERIGNORE AND GITIGNORE FILES  
By default, the balena CLI will use a single ".dockerignore" file (if any) at
the project root (--source directory) in order to decide which source files to
exclude from the "build context" (tar stream) sent to balenaCloud, Docker
daemon or balenaEngine. In a microservices (multicontainer) application, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) applications that define a docker-compose.yml file. When
this option is used, each service subdirectory (defined by the `build` or
`build.context` service properties in the docker-compose.yml file) is
filtered separately according to a .dockerignore file defined in the service
subdirectory. If no .dockerignore file exists in a service subdirectory, then
only the default .dockerignore patterns (see below) apply for that service
subdirectory.

When the --multi-dockerignore (-m) option is used, the .dockerignore file (if
any) defined at the overall project root will be used to filter files and
subdirectories other than service subdirectories. It will not have any effect
on service subdirectories, whether or not a service subdirectory defines its
own .dockerignore file. Multiple .dockerignore files are not merged or added
together, and cannot override or extend other files. This behavior maximises
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI releases older than v12.0.0 also took .gitignore files into account.
This behavior is deprecated, but may still be enabled with the --gitignore (-g)
option if compatibility is required. This option is mutually exclusive with
--multi-dockerignore (-m) and will be removed in the CLI's next major version
release (v13).

Default .dockerignore patterns  
When --gitignore (-g) is NOT used (i.e. when not in v11 compatibility mode), a
few default/hardcoded dockerignore patterns are "merged" (in memory) with the
patterns found in the applicable .dockerignore files, in the following order:
```
    **/.git
    < user's patterns from the applicable '.dockerignore' file, if any >
    !**/.balena
    !**/.resin
    !**/Dockerfile
    !**/Dockerfile.*
    !**/docker-compose.yml
```
These patterns always apply, whether or not .dockerignore files exist in the
project. If necessary, the effect of the `**/.git` pattern may be modified by
adding counter patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Examples:

	$ balena deploy myApp
	$ balena deploy myApp --build --source myBuildDir/
	$ balena deploy myApp myApp/myImage

### Arguments

#### APPNAME

the name of the application to deploy to

#### IMAGE

the image to deploy

### Options

#### -s, --source SOURCE

specify an alternate source directory; default is the working directory

#### -b, --build

force a rebuild before deploy

#### --nologupload

don't upload build logs to the dashboard with image (if building)

#### -e, --emulated

Use QEMU for ARM architecture emulation during the image build

#### --dockerfile DOCKERFILE

Alternative Dockerfile name/path, relative to the source folder

#### --logs

No-op and deprecated since balena CLI v12.0.0. Build logs are now shown by default.

#### --nologs

Hide the image build log output (produce less verbose output)

#### -g, --gitignore

Consider .gitignore files in addition to the .dockerignore file. This reverts
to the CLI v11 behavior/implementation (deprecated) if compatibility is required
until your project can be adapted.

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help build".

#### -G, --nogitignore

No-op (default behavior) since balena CLI v12.0.0. See "balena help build".

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### -R, --registry-secrets REGISTRY-SECRETS

Path to a YAML or JSON file with passwords for a private Docker registry

#### -l, --convert-eol

No-op and deprecated since balena CLI v12.0.0

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -n, --projectName PROJECTNAME

Specify an alternate project name; default is the directory name

#### -t, --tag TAG

The alias to the generated image

#### -B, --buildArg BUILDARG

Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

#### --cache-from CACHE-FROM

Comma-separated list (no spaces) of image names for build cache resolution. Implements the same feature as the "docker build --cache-from" option.

#### --nocache

Don't use docker layer caching when building

#### --pull

Pull the base images again even if they exist locally

#### --squash

Squash newly built layers into a single new layer

#### -P, --docker DOCKER

Path to a local docker socket (e.g. /var/run/docker.sock)

#### -h, --dockerHost DOCKERHOST

Docker daemon hostname or IP address (dev machine or balena device) 

#### -p, --dockerPort DOCKERPORT

Docker daemon TCP port number (hint: 2375 for balena devices)

#### --ca CA

Docker host TLS certificate authority file

#### --cert CERT

Docker host TLS certificate file

#### --key KEY

Docker host TLS key file

# Platform

## join [deviceIpOrHostname]

Move a local device to an application on another balena server, causing
the device to "join" the new server. The device must be running balenaOS.

For example, you could provision a device against an openBalena installation
where you perform end-to-end tests and then move it to balenaCloud when it's
ready for production.

To move a device between applications on the same server, use the
`balena device move` command instead of `balena join`.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This requires root privileges.  Likewise, if
the application flag is not provided then a picker will be shown.

Examples:

	$ balena join
	$ balena join balena.local
	$ balena join balena.local --application MyApp
	$ balena join 192.168.1.25
	$ balena join 192.168.1.25 --application MyApp

### Arguments

#### DEVICEIPORHOSTNAME

the IP or hostname of device

### Options

#### -a, --application APPLICATION

application name

#### -i, --pollInterval POLLINTERVAL

the interval in minutes to check for updates

## leave [deviceIpOrHostname]

Remove a local device from its balena application, causing the device to
"leave" the server it is provisioned on. This effectively makes the device
"unmanaged". The device must be running balenaOS.

The device entry on the server is preserved after running this command,
so the device can subsequently re-join the server if needed.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This usually requires root privileges.

Examples:

	$ balena leave
	$ balena leave balena.local
	$ balena leave 192.168.1.25

### Arguments

#### DEVICEIPORHOSTNAME

the device IP or hostname

### Options

# Utilities

## util available-drives

List available drives which are usable for writing an OS image to.
Does not list system drives.

### Options

# Support

## support &#60;action&#62;

Grant or revoke balena support agent access to devices and applications
on balenaCloud. (This command does not apply to openBalena.)
Access will be automatically revoked once the specified duration has elapsed.

Duration defaults to 24h, but can be specified using --duration flag in days
or hours, e.g. '12h', '2d'.

Both --device and --application flags accept multiple values, specified as
a comma-separated list (with no spaces).

Examples:

	balena support enable --device ab346f,cd457a --duration 3d
	balena support enable --application app3 --duration 12h
	balena support disable -a myApp

### Arguments

#### ACTION

enable|disable support access

### Options

#### -d, --device DEVICE

comma-separated list (no spaces) of device UUIDs

#### -a, --application APPLICATION

comma-separated list (no spaces) of application names

#### -t, --duration DURATION

length of time to enable support for, in (h)ours or (d)ays, e.g. 12h, 2d
