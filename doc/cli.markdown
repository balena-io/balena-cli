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
  balena CLI release **for Linux** is recommended. See
  [FAQ](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md) for using balena
  CLI with WSL and Docker Desktop for Windows.

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

> Note: The `balena ssh` command has additional setup requirements to work behind a proxy.
> Check the [installation instructions](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md),
> and ensure that the proxy server is configured to allow proxy requests to ssh port 22, using
> SSL encryption. For example, in the case of the [Squid](http://www.squid-cache.org/) proxy
> server, it should be configured with the following rules in the `squid.conf` file:  
> `acl SSL_ports port 22`  
> `acl Safe_ports port 22`  

#### Proxy exclusion

The `BALENARC_NO_PROXY` variable may be used to exclude specified destinations from proxying.

> * This feature requires balena CLI version 11.30.8 or later. In the case of the npm [installation
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

If you come across any problems or would like to get in touch:

* Check our [FAQ / troubleshooting document](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md).
* Ask us a question through the [balenaCloud forum](https://forums.balena.io/c/balena-cloud).
* For bug reports or feature requests,
  [have a look at the GitHub issues or create a new one](https://github.com/balena-io/balena-cli/issues/).


# CLI Command Reference

- API keys

	- [api-key generate &#60;name&#62;](#api-key-generate-name)

- Application

	- [apps](#apps)
	- [app &#60;name&#62;](#app-name)
	- [app create &#60;name&#62;](#app-create-name)
	- [app rm &#60;name&#62;](#app-rm-name)
	- [app restart &#60;name&#62;](#app-restart-name)

- Authentication

	- [login](#login)
	- [logout](#logout)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [device &#60;uuid&#62;](#device-uuid)
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
	- [device os-update &#60;uuid&#62;](#device-os-update-uuid)
	- [devices supported](#devices-supported)

- Environment Variables

	- [envs](#envs)
	- [env rm &#60;id&#62;](#env-rm-id)
	- [env add &#60;name&#62; [value]](#env-add-name-value)
	- [env rename &#60;id&#62; &#60;value&#62;](#env-rename-id-value)

- Tags

	- [tags](#tags)
	- [tag set &#60;tagKey&#62; [value]](#tag-set-tagkey-value)
	- [tag rm &#60;tagKey&#62;](#tag-rm-tagkey)

- Help and Version

	- [help [command...]](#help-command)
	- [version](#version)

- Keys

	- [keys](#keys)
	- [key &#60;id&#62;](#key-id)
	- [key add &#60;name&#62; [path]](#key-add-name-path)
	- [key rm &#60;id&#62;](#key-rm-id)

- Logs

	- [logs &#60;uuidOrDevice&#62;](#logs-uuidordevice)

- Network

	- [scan](#scan)
	- [ssh &#60;applicationOrDevice&#62; [serviceName]](#ssh-applicationordevice-servicename)
	- [tunnel &#60;deviceOrApplication&#62;](#tunnel-deviceorapplication)

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

- Deploy

	- [build [source]](#build-source)
	- [deploy &#60;appName&#62; [image]](#deploy-appname-image)

- Platform

	- [join [deviceiporhostname]](#join-deviceiporhostname)
	- [leave [deviceiporhostname]](#leave-deviceiporhostname)

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

## apps

list all your balena applications.

For detailed information on a particular application,
use `balena app <name> instead`.

Examples:

	$ balena apps

### Options

## app &#60;name&#62;

Display detailed information about a single balena application.

Examples:

	$ balena app MyApp

### Arguments

#### NAME

application name

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

## app rm &#60;name&#62;

Permanently remove a balena application.

The --yes option may be used to avoid interactive confirmation.

Examples:

	$ balena app rm MyApp
	$ balena app rm MyApp --yes

### Arguments

#### NAME

application name

### Options

#### -y, --yes

answer "yes" to all questions (non interactive use)

## app restart &#60;name&#62;

Restart all devices that belongs to a certain application.

Examples:

	$ balena app restart MyApp

### Arguments

#### NAME

application name

### Options

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

## device os-update &#60;uuid&#62;

Use this command to trigger a Host OS update for a device.

Notice this command will ask for confirmation interactively.
You can avoid this by passing the `--yes` boolean option.

Requires balenaCloud; will not work with openBalena or standalone balenaOS.

Examples:

	$ balena device os-update 23c73a1
	$ balena device os-update 23c73a1 --version 2.31.0+rev1.prod

### Options

#### --version &#60;version&#62;

a balenaOS version

#### --yes, -y

confirm non interactively

## devices supported

List the supported device types (like 'raspberrypi3' or 'intel-nuc').

The --verbose option adds extra columns/fields to the output, including the
"STATE" column whose values are one of 'beta', 'released' or 'discontinued'.
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

# Environment Variables

## envs

List the environment or configuration variables of an application, device or
service, as selected by the respective command-line options. (A service is
an application container in a "microservices" application.)

The --config option is used to list "configuration variables" that control
balena platform features, as opposed to custom environment variables defined
by the user. The --config and the --service options are mutually exclusive
because configuration variables cannot be set for specific services.

The --all option is used to include application-wide (fleet), device-wide
(multiple services on a device) and service-specific variables that apply to
the selected application, device or service. It can be thought of as including
"inherited" variables: for example, a service inherits device-wide variables,
and a device inherits application-wide variables. Variables are still filtered
out by type with the --config option, such that configuration and non-
configuration variables are never listed together.

When the --all option is used, the printed output may include DEVICE and/or
SERVICE columns to distinguish between application-wide, device-specific and
service-specific variables. As asterisk in these columns indicates that the
variable applies to "all devices" or "all services".

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
	$ balena envs --application MyApp --all --json
	$ balena envs --application MyApp --service MyService
	$ balena envs --application MyApp --all --service MyService
	$ balena envs --application MyApp --config
	$ balena envs --device 7cf02a6
	$ balena envs --device 7cf02a6 --all --json
	$ balena envs --device 7cf02a6 --config --all --json
	$ balena envs --device 7cf02a6 --all --service MyService

### Options

#### --all

include app-wide, device-wide variables that apply to the selected device or service.
Variables are still filtered out by type with the --config option.

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

## env rm ID

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

## env add NAME [VALUE]

Add an environment or config variable to an application, device or service,
as selected by the respective command-line options. Either the --application
or the --device option must be provided, and either may be be used alongside
the --service option to define a service-specific variable. (A service is an
application container in a "microservices" application.) When the --service
option is used in conjunction with the --device option, the service variable
applies to the selected device only. Otherwise, it applies to all devices of
the selected application (i.e., the application's fleet). If the --service
option is omitted, the variable applies to all services.

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
	$ balena env add EDITOR vim --application MyApp --service MyService
	$ balena env add EDITOR vim --device 7cf02a6
	$ balena env add EDITOR vim --device 7cf02a6 --service MyService

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

## env rename ID VALUE

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

Use this command to list all tags for
a particular application, device or release.

This command lists all application/device/release tags.

Example:

	$ balena tags --application MyApp
	$ balena tags --device 7cf02a6
	$ balena tags --release 1234
	$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6

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
	$ balena tag set myCompositeTag "my tag value with whitespaces" --device 7cf02a6
	$ balena tag set myCompositeTag myTagValue --release 1234
	$ balena tag set myCompositeTag --release 1234
	$ balena tag set myCompositeTag --release b376b0e544e9429483b656490e5b9443b4349bd6

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
	$ balena tag rm myTagKey --release b376b0e544e9429483b656490e5b9443b4349bd6

### Options

#### --application, -a, --app &#60;application&#62;

application name

#### --device, -d &#60;device&#62;

device uuid

#### --release, -r &#60;release&#62;

release id

# Help and Version

## help [command...]

Get detailed help for an specific command.

Examples:

	$ balena help apps
	$ balena help os download

### Options

#### --verbose, -v

show additional commands

## version

Display version information for the balena CLI and/or Node.js.

The --json option is recommended when scripting the output of this command,
because the JSON format is less likely to change and it better represents
data types like lists and empty strings. The 'jq' utility may be helpful
in shell scripts (https://stedolan.github.io/jq/manual/).

Examples:

	$ balena version
	$ balena version -a
	$ balena version -j

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

Register an SSH in balenaCloud for the logged in user.

If `path` is omitted, the command will attempt
to read the SSH key from stdin.

Examples:

	$ balena key add Main ~/.ssh/id_rsa.pub
	$ cat ~/.ssh/id_rsa.pub | balena key add Main

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
	$ balena logs 192.168.0.31 --service my-service-1 --service my-service-2

	$ balena logs 23c73a1.local --system
	$ balena logs 23c73a1.local --system --service my-service

### Options

#### --tail, -t

continuously stream output

#### --service, -s &#60;service&#62;

Reject logs not originating from this service.
This can be used in combination with --system or other --service flags.

#### --system, -S

Only show system logs. This can be used in combination with --service.

# Network

## scan

Scan for balenaOS devices on your local network.

Examples:

	$ balena scan
	$ balena scan --timeout 120
	$ balena scan --verbose

### Options

#### -v, --verbose

display full info

#### -t, --timeout TIMEOUT

scan timeout in seconds

## ssh &#60;applicationOrDevice&#62; [serviceName]

This command can be used to start a shell on a local or remote device.

If a service name is not provided, a shell will be opened on the host OS.

If an application name is provided, an interactive menu will be presented
for the selection of an online device. A shell will then be opened for the
host OS or service container of the chosen device.

For local devices, the IP address and .local domain name are supported.
If the device is referenced by IP or `.local` address, the connection
is initiated directly to balenaOS on port `22222` via an
openssh-compatible client. Otherwise, any connection initiated remotely
traverses the balenaCloud VPN.

Examples:
	balena ssh MyApp

	balena ssh f49cefd
	balena ssh f49cefd my-service
	balena ssh f49cefd --port <port>

	balena ssh 192.168.0.1 --verbose
	balena ssh f49cefd.local my-service

Warning: `balena ssh` requires an openssh-compatible client to be correctly
installed in your shell environment. For more information (including Windows
support) please check:
	https://github.com/balena-io/balena-cli/blob/master/INSTALL.md#additional-dependencies

### Options

#### --port, -p &#60;port&#62;

SSH server port number (default 22222) if the target is an IP address or .local
hostname. Otherwise, port number for the balenaCloud gateway (default 22).

#### --tty, -t

Force pseudo-terminal allocation (bypass TTY autodetection for stdin)

#### --verbose, -v

Increase verbosity

#### --noproxy

Bypass global proxy configuration for the ssh connection

## tunnel &#60;deviceOrApplication&#62;

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

## os configure IMAGE

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

#### --version VERSION

balenaOS version, for example "2.32.0" or "2.44.0+rev1"

#### -c, --system-connection SYSTEM-CONNECTION

paths to local files to place into the 'system-connections' directory

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

Preload a balena application release (app images/containers), and optionally
a balenaOS splash screen, in a previously downloaded balenaOS image file (or
Edison zip archive) in the local disk. The balenaOS image file can then be
flashed to a device's SD card.  When the device boots, it will not need to
download the application, as it was preloaded.

Warning: "balena preload" requires Docker to be correctly installed in
your shell environment. For more information (including Windows support)
check: https://github.com/balena-io/balena-cli/blob/master/INSTALL.md

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

Pin the preloaded device to the preloaded release on provision

#### --add-certificate &#60;certificate.crt&#62;

Add the given certificate (in PEM format) to /etc/ssl/certs in the preloading container.
The file name must end with '.crt' and must not be already contained in the preloader's
/etc/ssl/certs folder.
Can be repeated to add multiple certificates.

#### --docker, -P &#60;docker&#62;

Path to a local docker socket (e.g. /var/run/docker.sock)

#### --dockerHost, -h &#60;dockerHost&#62;

Docker daemon hostname or IP address (dev machine or balena device) 

#### --dockerPort &#60;dockerPort&#62;

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

When pushing to a local device a live session will be started.
The project source folder is watched for filesystem events, and changes
to files and folders are automatically synchronized to the running
containers. The synchronization is only in one direction, from this machine to
the device, and changes made on the device itself may be overwritten.
This feature requires a device running supervisor version v9.7.0 or greater.

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

For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-playground/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

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

### Options

#### --source, -s &#60;source&#62;

The source that should be sent to the balena builder to be built (defaults to the current directory)

#### --emulated, -e

Force an emulated build to occur on the remote builder

#### --dockerfile &#60;Dockerfile&#62;

Alternative Dockerfile name/path, relative to the source folder

#### --nocache, -c

Don't use cache when building this project

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a local YAML or JSON file containing Docker registry passwords used to pull base images.
Note that if registry-secrets are not provided on the command line, a secrets configuration
file from the balena directory will be used (usually $HOME/.balena/secrets.yml|.json)

#### --nolive

Don't run a live session on this push. The filesystem will not be monitored, and changes
will not be synchronized to any running containers. Note that both this flag and --detached
and required to cause the process to end once the initial build has completed.

#### --detached, -d

When pushing to the cloud, this option will cause the build to start, then return execution
back to the shell, with the status and release ID (if applicable).

When pushing to a local mode device, this option will cause the command to not tail application logs when the build
has completed.

#### --service &#60;service&#62;

Reject logs not originating from this service.
This can be used in combination with --system and other --service flags.
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

#### --convert-eol, -l

On Windows only, convert line endings from CRLF (Windows format) to LF (Unix format).
Source files are not modified.

# Settings

## settings

Use this command to display current balena CLI settings.

Examples:

	$ balena settings

### Options

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

# Deploy

## build [source]

Use this command to build an image or a complete multicontainer project with
the provided docker daemon in your development machine or balena device.
(See also the `balena push` command for the option of building images in the
balenaCloud build servers.)

You must provide either an application or a device-type/architecture pair to use
the balena Dockerfile pre-processor (e.g. Dockerfile.template -> Dockerfile).

This command will look into the given source directory (or the current working
directory if one isn't specified) for a docker-compose.yml file, and if found,
each service defined in the compose file will be built. If a compose file isn't
found, it will look for a Dockerfile[.template] file (or alternative Dockerfile
specified with the `--dockerfile` option), and if no dockerfile is found, it
will try to generate one.

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

For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-playground/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

Examples:

	$ balena build
	$ balena build ./source/
	$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated
	$ balena build --application MyApp ./source/
	$ balena build --docker /var/run/docker.sock   # Linux, Mac
	$ balena build --docker //./pipe/docker_engine # Windows
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

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a YAML or JSON file with passwords for a private Docker registry

#### --convert-eol, -l

On Windows only, convert line endings from CRLF (Windows format) to LF (Unix format). Source files are not modified.

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

#### --cache-from &#60;image-list&#62;

Comma-separated list (no spaces) of image names for build cache resolution. Implements the same feature as the "docker build --cache-from" option.

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

For a sample project using registry secrets with the Google Container Registry,
check: https://github.com/balena-io-playground/sample-gcr-registry-secrets

If the --registry-secrets option is not specified, and a secrets.yml or
secrets.json file exists in the balena directory (usually $HOME/.balena),
this file will be used instead.

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

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### --registry-secrets, -R &#60;secrets.yml|.json&#62;

Path to a YAML or JSON file with passwords for a private Docker registry

#### --convert-eol, -l

On Windows only, convert line endings from CRLF (Windows format) to LF (Unix format). Source files are not modified.

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

#### --cache-from &#60;image-list&#62;

Comma-separated list (no spaces) of image names for build cache resolution. Implements the same feature as the "docker build --cache-from" option.

#### --nocache

Don't use docker layer caching when building

#### --squash

Squash newly built layers into a single new layer

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

Use this command to list your machine's drives usable for writing the OS image to.
Skips the system drives.
