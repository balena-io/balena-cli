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
    `pacman -S git gcc make openssh p7zip`
  * [Set a Windows environment variable](https://www.onmsft.com/how-to/how-to-set-an-environment-variable-in-windows-10): `MSYS2_PATH_TYPE=inherit`
  * Note that a bug in the MSYS2 launch script (`msys2_shell.cmd`) makes text-based interactive CLI
    menus to break. [Check this Github issue for a
    workaround](https://github.com/msys2/MINGW-packages/issues/1633#issuecomment-240583890).

* [MSYS](http://www.mingw.org/wiki/MSYS)
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
[balena_comp](https://github.com/balena-io/balena-cli/blob/master/completion/balena-completion.bash)
file to your system's `bash_completion` directory: check [Docker's command completion
guide](https://docs.docker.com/compose/completion/) for system setup instructions.

## Logging in

Several CLI commands require access to your balenaCloud account, for example in order to push a
new release to your fleet. Those commands require creating a CLI login session by running:

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
* Ask us a question in the [balena forums](https://forums.balena.io/c/product-support)

For CLI bug reports or feature requests, check the
[CLI GitHub issues](https://github.com/balena-io/balena-cli/issues/).

## Deprecation policy

The balena CLI uses [semver versioning](https://semver.org/), with the concepts
of major, minor and patch version releases.

The latest release of a major version of the balena CLI will remain compatible with
the balenaCloud backend services for at least one year from the date when the
following major version is released. For example, balena CLI v11.36.0, as the
latest v11 release, would remain compatible with the balenaCloud backend for one
year from the date when v12.0.0 was released.

Half way through to that period (6 months after the release of the next major
version), older major versions of the balena CLI will start printing a deprecation
warning message when it is used interactively (when `stderr` is attached to a TTY
device file). At the end of that period, older major versions will exit with an
error message unless the `--unsupported` flag is used.  This behavior was
introduced in CLI version 12.47.0 and is also documented by `balena help`.
To take advantage of the latest backend features and ensure compatibility, users
are encouraged to regularly update the balena CLI to the latest version.


# CLI Command Reference

- API keys

	- [api-key generate &#60;name&#62;](#api-key-generate-name)

- Fleet

	- [fleets](#fleets)
	- [fleet &#60;fleet&#62;](#fleet-fleet)
	- [fleet create &#60;name&#62;](#fleet-create-name)
	- [fleet purge &#60;fleet&#62;](#fleet-purge-fleet)
	- [fleet rename &#60;fleet&#62; [newname]](#fleet-rename-fleet-newname)
	- [fleet restart &#60;fleet&#62;](#fleet-restart-fleet)
	- [fleet rm &#60;fleet&#62;](#fleet-rm-fleet)

- Authentication

	- [login](#login)
	- [logout](#logout)
	- [whoami](#whoami)

- Device

	- [devices](#devices)
	- [devices supported](#devices-supported)
	- [device &#60;uuid&#62;](#device-uuid)
	- [device deactivate &#60;uuid&#62;](#device-deactivate-uuid)
	- [device identify &#60;uuid&#62;](#device-identify-uuid)
	- [device init](#device-init)
	- [device local-mode &#60;uuid&#62;](#device-local-mode-uuid)
	- [device move &#60;uuid(s)&#62;](#device-move-uuid-s)
	- [device os-update &#60;uuid&#62;](#device-os-update-uuid)
	- [device public-url &#60;uuid&#62;](#device-public-url-uuid)
	- [device purge &#60;uuid&#62;](#device-purge-uuid)
	- [device reboot &#60;uuid&#62;](#device-reboot-uuid)
	- [device register &#60;fleet&#62;](#device-register-fleet)
	- [device rename &#60;uuid&#62; [newname]](#device-rename-uuid-newname)
	- [device restart &#60;uuid&#62;](#device-restart-uuid)
	- [device rm &#60;uuid(s)&#62;](#device-rm-uuid-s)
	- [device shutdown &#60;uuid&#62;](#device-shutdown-uuid)

- Releases

	- [releases &#60;fleet&#62;](#releases-fleet)
	- [release &#60;commitorid&#62;](#release-commitorid)
	- [release finalize &#60;commitorid&#62;](#release-finalize-commitorid)

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
	- [ssh &#60;fleetordevice&#62; [service]](#ssh-fleetordevice-service)
	- [tunnel &#60;deviceorfleet&#62;](#tunnel-deviceorfleet)

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

	- [push &#60;fleetordevice&#62;](#push-fleetordevice)

- Settings

	- [settings](#settings)

- Local

	- [local configure &#60;target&#62;](#local-configure-target)
	- [local flash &#60;image&#62;](#local-flash-image)

- Deploy

	- [build [source]](#build-source)
	- [deploy &#60;fleet&#62; [image]](#deploy-fleet-image)

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

# Fleet

## fleets

List all your balena fleets.

For detailed information on a particular fleet, use
`balena fleet <fleet>`

Examples:

	$ balena fleets

### Options

#### --fields FIELDS

only show provided fields (comma-separated)

#### -j, --json

output in json format

#### --filter FILTER

filter results by substring matching of a given field, eg: --filter field=foo

#### --no-header

hide table header from output

#### --no-truncate

do not truncate output to fit screen

#### --sort SORT

field to sort by (prepend '-' for descending order)

## fleet &#60;fleet&#62;

Display detailed information about a single fleet.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena fleet MyFleet
	$ balena fleet myorg/myfleet
	$ balena fleet myorg/myfleet --view

### Arguments

#### FLEET

fleet name or slug (preferred)

### Options

#### --view

open fleet dashboard page

#### --fields FIELDS

only show provided fields (comma-separated)

#### -j, --json

output in json format

## fleet create &#60;name&#62;

Create a new balena fleet.

You can specify the organization the fleet should belong to using
the `--organization` option. The organization's handle, not its name,
should be provided. Organization handles can be listed with the
`balena orgs` command.

The fleet's default device type is specified with the `--type` option.
The `balena devices supported` command can be used to list the available
device types.

Interactive dropdowns will be shown for selection if no device type or
organization is specified and there are multiple options to choose from.
If there is a single option to choose from, it will be chosen automatically.
This interactive behavior can be disabled by explicitly specifying a device
type and organization.

Examples:

	$ balena fleet create MyFleet
	$ balena fleet create MyFleet --organization mmyorg
	$ balena fleet create MyFleet -o myorg --type raspberry-pi

### Arguments

#### NAME

fleet name

### Options

#### -o, --organization ORGANIZATION

handle of the organization the fleet should belong to

#### -t, --type TYPE

fleet device type (Check available types with `balena devices supported`)

## fleet purge &#60;fleet&#62;

Purge data from all devices belonging to a fleet.
This will clear the fleet's '/data' directory.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena fleet purge MyFleet
	$ balena fleet purge myorg/myfleet

### Arguments

#### FLEET

fleet name or slug (preferred)

### Options

## fleet rename &#60;fleet&#62; [newName]

Rename a fleet.

Note, if the `newName` parameter is omitted, it will be
prompted for interactively.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena fleet rename OldName
	$ balena fleet rename OldName NewName
	$ balena fleet rename myorg/oldname NewName

### Arguments

#### FLEET

fleet name or slug (preferred)

#### NEWNAME

the new name for the fleet

### Options

## fleet restart &#60;fleet&#62;

Restart all devices belonging to a fleet.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena fleet restart MyFleet
	$ balena fleet restart myorg/myfleet

### Arguments

#### FLEET

fleet name or slug (preferred)

### Options

## fleet rm &#60;fleet&#62;

Permanently remove a fleet.

The --yes option may be used to avoid interactive confirmation.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena fleet rm MyFleet
	$ balena fleet rm MyFleet --yes
	$ balena fleet rm myorg/myfleet

### Arguments

#### FLEET

fleet name or slug (preferred)

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

#### -H, --hideExperimentalWarning

Hides warning for experimental features

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

List all of your devices.

Devices can be filtered by fleet with the `--fleet` option.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

The --json option is recommended when scripting the output of this command,
because field names are less likely to change in JSON format and because it
better represents data types like arrays, empty strings and null values.
The 'jq' utility may be helpful for querying JSON fields in shell scripts
(https://stedolan.github.io/jq/manual/).

Examples:

	$ balena devices
	$ balena devices --fleet MyFleet
	$ balena devices -f myorg/myfleet

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -j, --json

produce JSON output instead of tabular output

## devices supported

List the supported device types (like 'raspberrypi3' or 'intel-nuc').

The --json option is recommended when scripting the output of this command,
because the JSON format is less likely to change and it better represents data
types like lists and empty strings (for example, the ALIASES column contains a
list of zero or more values). The 'jq' utility may be helpful in shell scripts
(https://stedolan.github.io/jq/manual/).

Examples:

	$ balena devices supported
	$ balena devices supported --json

### Options

#### -j, --json

produce JSON output instead of tabular output

## device &#60;uuid&#62;

Show information about a single device.

Examples:

	$ balena device 7cf02a6
	$ balena device 7cf02a6 --view

### Arguments

#### UUID

the device uuid

### Options

#### --view

open device dashboard page

## device deactivate &#60;uuid&#62;

Deactivate a device.

Note this command asks for confirmation interactively.
You can avoid this by passing the `--yes` option.

Examples:

	$ balena device deactivate 7cf02a6
	$ balena device deactivate 7cf02a6 --yes

### Arguments

#### UUID

the UUID of the device to be deactivated

### Options

#### -y, --yes

answer "yes" to all questions (non interactive use)

## device identify &#60;uuid&#62;

Identify a device by making the ACT LED blink (Raspberry Pi).

Examples:

	$ balena device identify 23c73a1

### Arguments

#### UUID

the uuid of the device to identify

### Options

## device init

Register a new device in the selected fleet, download the OS image for the
fleet's default device type, configure the image and write it to an SD card.
This command effectively combines several other balena CLI commands in one,
namely:

'balena device register'  
'balena os download'  
'balena os build-config' or 'balena config generate'  
'balena os configure'  
'balena os local flash'

Possible arguments for the '--fleet', '--os-version' and '--drive' options can
be listed respectively with the commands:

'balena fleets'  
'balena os versions'  
'balena util available-drives'

If the '--fleet' or '--drive' options are omitted, interactive menus will be
presented with values to choose from. If the '--os-version' option is omitted,
the latest released OS version for the fleet's default device type will be used.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Image configuration questions will be asked interactively unless a pre-configured
'config.json' file is provided with the '--config' option.  The file can be
generated with the 'balena config generate' or 'balena os build-config' commands.

Examples:

	$ balena device init
	$ balena device init -f myorg/myfleet
	$ balena device init --fleet myFleet --os-version 2.101.7 --drive /dev/disk5 --config config.json --yes
	$ balena device init --fleet myFleet --os-version 2.83.21+rev1.prod --drive /dev/disk5 --config config.json --yes

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

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

#### --provisioning-key-name PROVISIONING-KEY-NAME

custom key name assigned to generated provisioning api key

#### --provisioning-key-expiry-date PROVISIONING-KEY-EXPIRY-DATE

expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)

## device local-mode &#60;uuid&#62;

Output current local mode status, or enable/disable local mode
for specified device.

Examples:

	$ balena device local-mode 23c73a1
	$ balena device local-mode 23c73a1 --enable
	$ balena device local-mode 23c73a1 --disable
	$ balena device local-mode 23c73a1 --status

### Arguments

#### UUID

the uuid of the device to manage

### Options

#### --enable

enable local mode

#### --disable

disable local mode

#### --status

output boolean indicating local mode status

## device move &#60;uuid(s)&#62;

Move one or more devices to another fleet.

If --fleet is omitted, the fleet will be prompted for interactively.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena device move 7cf02a6
	$ balena device move 7cf02a6,dc39e52
	$ balena device move 7cf02a6 --fleet MyNewFleet
	$ balena device move 7cf02a6 -f myorg/mynewfleet

### Arguments

#### UUID

comma-separated list (no blank spaces) of device UUIDs to be moved

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

## device os-update &#60;uuid&#62;

Start a Host OS update for a device.

Note this command will ask for confirmation interactively.
This can be avoided by passing the `--yes` option.

Requires balenaCloud; will not work with openBalena or standalone balenaOS.

Examples:

	$ balena device os-update 23c73a1
	$ balena device os-update 23c73a1 --version 2.101.7
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

Examples:

	$ balena device public-url 23c73a1
	$ balena device public-url 23c73a1 --enable
	$ balena device public-url 23c73a1 --disable
	$ balena device public-url 23c73a1 --status

### Arguments

#### UUID

the uuid of the device to manage

### Options

#### --enable

enable the public URL

#### --disable

disable the public URL

#### --status

determine if public URL is enabled

## device purge &#60;uuid&#62;

Purge data from a device.
This will clear the device's "/data" directory.

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

## device register &#60;fleet&#62;

Register a new device with a balena fleet.

If --uuid is not provided, a new UUID will be automatically assigned.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena device register MyFleet
	$ balena device register MyFleet --uuid <uuid>
	$ balena device register myorg/myfleet --uuid <uuid>
	$ balena device register myorg/myfleet --uuid <uuid> --deviceType <deviceTypeSlug>

### Arguments

#### FLEET

fleet name or slug (preferred)

### Options

#### -u, --uuid UUID

custom uuid

#### --deviceType DEVICETYPE

device type slug (run 'balena devices supported' for possible values)

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

# Releases

## releases &#60;fleet&#62;

List all releases of the given fleet.

Fleets may be specified by fleet name or slug. Slugs are recommended because
they are unique and unambiguous. Slugs can be listed with the `balena fleets`
command. Note that slugs may change if the fleet is renamed. Fleet names are
not unique and may result in "Fleet is ambiguous" errors at any time (even if
"it used to work in the past"), for example if the name clashes with a newly
created public/open fleet, or with fleets from other balena accounts that you
may be invited to join under any role.  For this reason, fleet names are
especially discouraged in scripts (e.g. CI environments).

The --json option is recommended when scripting the output of this command,
because field names are less likely to change in JSON format and because it
better represents data types like arrays, empty strings and null values.
The 'jq' utility may be helpful for querying JSON fields in shell scripts
(https://stedolan.github.io/jq/manual/).

Examples:

	$ balena releases myorg/myfleet
	$ balena releases myorg/myfleet --json

### Arguments

#### FLEET

fleet name or slug (preferred)

### Options

#### -j, --json

produce JSON output instead of tabular output

## release &#60;commitOrId&#62;



Examples:

	$ balena release a777f7345fe3d655c1c981aa642e5555
	$ balena release 1234567

### Arguments

#### COMMITORID

the commit or ID of the release to get information

### Options

#### -c, --composition

Return the release composition

## release finalize &#60;commitOrId&#62;

Finalize a release. Releases can be "draft" or "final", and this command
changes a draft release into a final release. Draft releases can be created
with the `--draft` option of the `balena build` or `balena deploy`
commands.

Draft releases are not automatically deployed to devices tracking the latest
release. For a draft release to be deployed to a device, the device should be
explicity pinned to that release. Conversely, final releases may trigger immediate
deployment to unpinned devices (subject to a device's  polling period) and, for
this reason, final releases cannot be changed back to draft status.

Examples:

	$ balena release finalize a777f7345fe3d655c1c981aa642e5555
	$ balena release finalize 1234567

### Arguments

#### COMMITORID

the commit or ID of the release to finalize

### Options

# Environment Variables

## envs

List the environment or configuration variables of a fleet, device or
service, as selected by the respective command-line options. (A service
corresponds to a Docker image/container in a microservices fleet.)

The results include fleet-wide (multiple devices), device-specific (multiple
services on a specific device) and service-specific variables that apply to the
selected fleet, device or service. It can be thought of as including inherited
variables; for example, a service inherits device-wide variables, and a device
inherits fleet-wide variables.

The printed output may include DEVICE and/or SERVICE columns to distinguish
between fleet-wide, device-specific and service-specific variables.
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
for the given query. When querying variables for a device, note that the fleet
name may be null in JSON output (or 'N/A' in tabular output) if the fleet that
the device belonged to is no longer accessible by the current user (for example,
in case the current user was removed from the fleet by the fleet's owner).

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena envs --fleet myorg/myfleet
	$ balena envs --fleet MyFleet --json
	$ balena envs --fleet MyFleet --service MyService
	$ balena envs --fleet MyFleet --config
	$ balena envs --device 7cf02a6
	$ balena envs --device 7cf02a6 --json
	$ balena envs --device 7cf02a6 --config --json
	$ balena envs --device 7cf02a6 --service MyService

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -c, --config

show configuration variables only

#### -d, --device DEVICE

device UUID

#### -j, --json

produce JSON output instead of tabular output

#### -s, --service SERVICE

service name

## env rm &#60;id&#62;

Remove a configuration or environment variable from a fleet, device
or service, as selected by command-line options.

Variables are selected by their database ID (as reported by the 'balena envs'
command) and one of six database "resource types":

- fleet environment variable
- fleet configuration variable (--config)
- fleet service variable (--service)
- device environment variable (--device)
- device configuration variable (--device --config)
- device service variable (--device --service)

The --device option selects a device-specific variable instead of a fleet
variable.

The --config option selects a configuration variable. Configuration variable
names typically start with the 'BALENA_' or 'RESIN_' prefixes and are used to
configure balena platform features.

The --service option selects a service variable, which is an environment variable
that applies to a specifc service (container) in a microservices (multicontainer)
fleet.

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

select a device-specific variable instead of a fleet variable

#### -s, --service

select a service variable (may be used together with the --device option)

#### -y, --yes

do not prompt for confirmation before deleting the variable

## env add &#60;name&#62; [value]

Add an environment or config variable to one or more fleets, devices or
services, as selected by the respective command-line options. Either the
--fleet or the --device option must be provided,  and either may be be
used alongside the --service option to define a service-specific variable.
(A service corresponds to a Docker image/container in a microservices fleet.)
When the --service option is used in conjunction with the --device option,
the service variable applies to the selected device only.  Otherwise, it
applies to all devices of the selected fleet. If the --service option is
omitted, the variable applies to all services.

If VALUE is omitted, the CLI will attempt to use the value of the environment
variable of same name in the CLI process' environment. In this case, a warning
message will be printed. Use `--quiet` to suppress it.

'BALENA_' or 'RESIN_' are reserved variable name prefixes used to identify
"configuration variables". Configuration variables control balena platform
features and are treated specially by balenaOS and the balena supervisor
running on devices. They are also stored differently in the balenaCloud API
database. Configuration variables cannot be set for specific services,
therefore the --service option cannot be used when the variable name starts
with a reserved prefix. When defining custom fleet variables, please avoid
these reserved prefixes.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena env add TERM --fleet MyFleet
	$ balena env add EDITOR vim -f myorg/myfleet
	$ balena env add EDITOR vim --fleet MyFleet,MyFleet2
	$ balena env add EDITOR vim --fleet MyFleet --service MyService
	$ balena env add EDITOR vim --fleet MyFleet,MyFleet2 --service MyService,MyService2
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

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -d, --device DEVICE

device UUID

#### -q, --quiet

suppress warning messages

#### -s, --service SERVICE

service name

## env rename &#60;id&#62; &#60;value&#62;

Change the value of a configuration or environment variable for a fleet,
device or service, as selected by command-line options.

Variables are selected by their database ID (as reported by the 'balena envs'
command) and one of six database "resource types":

- fleet environment variable
- fleet configuration variable (--config)
- fleet service variable (--service)
- device environment variable (--device)
- device configuration variable (--device --config)
- device service variable (--device --service)

The --device option selects a device-specific variable instead of a fleet
variable.

The --config option selects a configuration variable. Configuration variable
names typically start with the 'BALENA_' or 'RESIN_' prefixes and are used to
configure balena platform features.

The --service option selects a service variable, which is an environment variable
that applies to a specifc service (container) in a microservices (multicontainer)
fleet.

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

select a device-specific variable instead of a fleet variable

#### -s, --service

select a service variable (may be used together with the --device option)

# Tags

## tags

List all tags and their values for the specified fleet, device or release.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena tags --fleet MyFleet
	$ balena tags -f myorg/myfleet
	$ balena tags --device 7cf02a6
	$ balena tags --release 1234
	$ balena tags --release b376b0e544e9429483b656490e5b9443b4349bd6

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

## tag rm &#60;tagKey&#62;

Remove a tag from a fleet, device or release.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena tag rm myTagKey --fleet MyFleet
	$ balena tag rm myTagKey -f myorg/myfleet
	$ balena tag rm myTagKey --device 7cf02a6
	$ balena tag rm myTagKey --release 1234
	$ balena tag rm myTagKey --release b376b0e544e9429483b656490e5b9443b4349bd6

### Arguments

#### TAGKEY

the key string of the tag

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

## tag set &#60;tagKey&#62; [value]

Set a tag on a fleet, device or release.

You can optionally provide a value to be associated with the created
tag, as an extra argument after the tag key. If a value isn't
provided, a tag with an empty value is created.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena tag set mySimpleTag --fleet MyFleet
	$ balena tag set mySimpleTag -f myorg/myfleet
	$ balena tag set myCompositeTag myTagValue --fleet MyFleet
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

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -d, --device DEVICE

device UUID

#### -r, --release RELEASE

release id

# Help and Version

## help [command]

List balena commands, or get detailed help for a specific command.

Examples:

	$ balena help
	$ balena help login
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

## ssh &#60;fleetOrDevice&#62; [service]

Start a shell on a local or remote device. If a service name is not provided,
a shell will be opened on the host OS.

If a fleet is provided, an interactive menu will be presented for the selection
of an online device. A shell will then be opened for the host OS or service
container of the chosen device.

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

	$ balena ssh MyFleet
	$ balena ssh f49cefd
	$ balena ssh f49cefd my-service
	$ balena ssh f49cefd --port <port>
	$ balena ssh 192.168.0.1 --verbose
	$ balena ssh f49cefd.local my-service
	$ echo "uptime; exit;" | balena ssh f49cefd
	$ echo "uptime; exit;" | balena ssh 192.168.0.1 myService

### Arguments

#### FLEETORDEVICE

fleet name/slug, device uuid, or address of local device

#### SERVICE

service name, if connecting to a container

### Options

#### -p, --port PORT

SSH server port number (default 22222) if the target is an IP address or .local
hostname. Otherwise, port number for the balenaCloud gateway (default 22).

#### -t, --tty

force pseudo-terminal allocation (bypass TTY autodetection for stdin)

#### -v, --verbose

increase verbosity

#### --noproxy

bypass global proxy configuration for the ssh connection

## tunnel &#60;deviceOrFleet&#62;

Use this command to open local TCP ports that tunnel to listening sockets in a
balenaOS device.

For example, this command could be used to expose the ssh server of a balenaOS
device (port number 22222) on the local machine, or to expose a web server
running on the device. The port numbers do not have be the same between the
device and the local machine, and multiple ports may be tunneled in a single
command line.

Port mappings are specified in the format: <remotePort>[:[localIP:]localPort]
localIP defaults to 'localhost', and localPort defaults to the specified
remotePort value.

Note: the -p (--port) flag must be provided at the end of the command line,
as per examples.

In the case of openBalena, the tunnel command in CLI v12.38.5 or later requires
openBalena v3.1.2 or later. Older CLI versions work with older openBalena
versions.

Examples:

	# map remote port 22222 to localhost:22222
	$ balena tunnel myFleet -p 22222
	
	# map remote port 22222 to localhost:222
	$ balena tunnel 2ead211 -p 22222:222
	
	# map remote port 22222 to any address on your host machine, port 22222
	$ balena tunnel 1546690 -p 22222:0.0.0.0
	
	# map remote port 22222 to any address on your host machine, port 222
	$ balena tunnel myFleet -p 22222:0.0.0.0:222
	
	# multiple port tunnels can be specified at any one time
	$ balena tunnel myFleet -p 8080:3000 -p 8081:9000

### Arguments

#### DEVICEORFLEET

device UUID or fleet name/slug

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

balenaOS ESR versions can be listed with the '--esr' option. See also:
https://www.balena.io/docs/reference/OS/extended-support-release/

Examples:

	$ balena os versions raspberrypi3

### Arguments

#### TYPE

device type

### Options

#### --esr

select balenaOS ESR versions

## os download &#60;type&#62;

Download an unconfigured OS image for the specified device type.
Check available device types with 'balena devices supported'.

Note: Currently this command only works with balenaCloud, not openBalena.
If using openBalena, please download the OS from: https://www.balena.io/os/

The '--version' option is used to select the balenaOS version. If omitted,
the latest released version is downloaded (and if only pre-release versions
exist, the latest pre-release version is downloaded).

Use '--version menu' or '--version menu-esr' to interactively select the
OS version. The latter lists ESR versions which are only available for
download on Production and Enterprise plans. See also:
https://www.balena.io/docs/reference/OS/extended-support-release/

Development images can be selected by appending `.dev` to the version.

Examples:

	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.101.7
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2022.7.0
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version ^2.90.0
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2.60.1+rev1.dev
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version 2021.10.2.prod
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version latest
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version default
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu
	$ balena os download raspberrypi3 -o ../foo/bar/raspberry-pi.img --version menu-esr

### Arguments

#### TYPE

the device type

### Options

#### -o, --output OUTPUT

output path

#### --version VERSION

version number (ESR or non-ESR versions),
or semver range (non-ESR versions only),
or 'latest' (includes pre-releases),
or 'default' (excludes pre-releases if at least one released version is available),
or 'recommended' (excludes pre-releases, will fail if only pre-release versions are available),
or 'menu' (interactive menu, non-ESR versions),
or 'menu-esr' (interactive menu, ESR versions)

## os build-config &#60;image&#62; &#60;device-type&#62;

Interactively generate a configuration file that can then be used as
non-interactive input by the 'balena os configure' command.

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

Configure a previously downloaded balenaOS image for a specific device type
or fleet.

Configuration settings such as WiFi authentication will be taken from the
following sources, in precedence order:
1. Command-line options like `--config-wifi-ssid`
2. A given `config.json` file specified with the `--config` option.
3. User input through interactive prompts (text menus).

The --device-type option is used to override the fleet's default device type,
in case of a fleet with mixed device types.

The '--dev' option is used to configure balenaOS to operate in development mode,
allowing anauthenticated root ssh access and exposing network ports such as
balenaEngine's 2375 (unencrypted). This option causes `"developmentMode": true`
to be inserted in the 'config.json' file in the image's boot partion. Development
mode (as a configurable option) is applicable to balenaOS releases from early
2022. Older releases have separate development and production balenaOS images
that cannot be reconfigured through 'config.json' or the '--dev' option. Do not
confuse the balenaOS "development mode" with a device's "local mode", the latter
being a supervisor feature that allows the "balena push" command to push a user's
application directly to a device in the local network.

The '--secureBoot' option is used to configure a balenaOS installer image to opt-in
secure boot and disk encryption.

The --system-connection (-c) option is used to inject NetworkManager connection
profiles for additional network interfaces, such as cellular/GSM or additional
WiFi or ethernet connections. This option may be passed multiple times in case there
are multiple files to inject. See connection profile examples and reference at:
https://www.balena.io/docs/reference/OS/network/2.x/
https://developer.gnome.org/NetworkManager/stable/ref-settings.html

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Note: This command is currently not supported on Windows natively. Windows users
are advised to install the Windows Subsystem for Linux (WSL) with Ubuntu, and use
the Linux release of the balena CLI:
https://docs.microsoft.com/en-us/windows/wsl/about

Examples:

	$ balena os configure ../path/rpi3.img --device 7cf02a6
	$ balena os configure ../path/rpi3.img --fleet myorg/myfleet
	$ balena os configure ../path/rpi3.img --fleet MyFleet --version 2.12.7
	$ balena os configure ../path/rpi3.img -f MyFinFleet --device-type raspberrypi3
	$ balena os configure ../path/rpi3.img -f MyFinFleet --device-type raspberrypi3 --config myWifiConfig.json

### Arguments

#### IMAGE

path to a balenaOS image file, e.g. "rpi3.img"

### Options

#### -v, --advanced

ask advanced configuration questions (when in interactive mode)

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### --config CONFIG

path to a pre-generated config.json file to be injected in the OS image

#### --config-app-update-poll-interval CONFIG-APP-UPDATE-POLL-INTERVAL

supervisor cloud polling interval in minutes (e.g. for variable updates)

#### --config-network CONFIG-NETWORK

device network type (non-interactive configuration)

#### --config-wifi-key CONFIG-WIFI-KEY

WiFi key (password) (non-interactive configuration)

#### --config-wifi-ssid CONFIG-WIFI-SSID

WiFi SSID (network name) (non-interactive configuration)

#### --dev

Configure balenaOS to operate in development mode

#### --secureBoot

Configure balenaOS installer to opt-in secure boot and disk encryption

#### -d, --device DEVICE

device UUID

#### --device-type DEVICE-TYPE

device type slug (e.g. "raspberrypi3") to override the fleet device type

#### --initial-device-name INITIAL-DEVICE-NAME

This option will set the device name when the device provisions

#### --version VERSION

balenaOS version, for example "2.32.0" or "2.44.0+rev1"

#### -c, --system-connection SYSTEM-CONNECTION

paths to local files to place into the 'system-connections' directory

#### --provisioning-key-name PROVISIONING-KEY-NAME

custom key name assigned to generated provisioning api key

#### --provisioning-key-expiry-date PROVISIONING-KEY-EXPIRY-DATE

expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)

## os initialize &#60;image&#62;

Initialize an os image for a device with a previously
		configured operating system image and flash the
		an external storage drive or the device's storage
		medium depending on the device type.
		

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

Generate a config.json file for a device or fleet.

The target balenaOS version must be specified with the --version option.

The '--dev' option is used to configure balenaOS to operate in development mode,
allowing anauthenticated root ssh access and exposing network ports such as
balenaEngine's 2375 (unencrypted). This option causes `"developmentMode": true`
to be inserted in the 'config.json' file in the image's boot partion. Development
mode (as a configurable option) is applicable to balenaOS releases from early
2022. Older releases have separate development and production balenaOS images
that cannot be reconfigured through 'config.json' or the '--dev' option. Do not
confuse the balenaOS "development mode" with a device's "local mode", the latter
being a supervisor feature that allows the "balena push" command to push a user's
application directly to a device in the local network.

The '--secureBoot' option is used to configure a balenaOS installer image to opt-in
secure boot and disk encryption.

To configure an image for a fleet of mixed device types, use the --fleet option
alongside the --deviceType option to specify the target device type.

To avoid interactive questions, specify a command line option for each question that
would otherwise be asked.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena config generate --device 7cf02a6 --version 2.12.7
	$ balena config generate --device 7cf02a6 --version 2.12.7 --generate-device-api-key
	$ balena config generate --device 7cf02a6 --version 2.12.7 --deviceApiKey <existingDeviceKey>
	$ balena config generate --device 7cf02a6 --version 2.12.7 --output config.json
	$ balena config generate --fleet myorg/fleet --version 2.12.7 --dev
	$ balena config generate --fleet myorg/fleet --version 2.12.7 --secureBoot
	$ balena config generate --fleet myorg/fleet --version 2.12.7 --deviceType fincm3
	$ balena config generate --fleet myorg/fleet --version 2.12.7 --output config.json
	$ balena config generate --fleet myorg/fleet --version 2.12.7 --network wifi --wifiSsid mySsid --wifiKey abcdefgh --appUpdatePollInterval 15

### Options

#### --version VERSION

a balenaOS version

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### --dev

Configure balenaOS to operate in development mode

#### --secureBoot

Configure balenaOS installer to opt-in secure boot and disk encryption

#### -d, --device DEVICE

device UUID

#### -k, --deviceApiKey DEVICEAPIKEY

custom device key - note that this is only supported on balenaOS 2.0.3+

#### --deviceType DEVICETYPE

device type slug (run 'balena devices supported' for possible values)

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

supervisor cloud polling interval in minutes (e.g. for device variables)

#### --provisioning-key-name PROVISIONING-KEY-NAME

custom key name assigned to generated provisioning api key

#### --provisioning-key-expiry-date PROVISIONING-KEY-EXPIRY-DATE

expiry date assigned to generated provisioning api key (format: YYYY-MM-DD)

## config inject &#60;file&#62;

Inject a 'config.json' file to a balenaOS image file or attached SD card or
USB stick.

Documentation for the balenaOS 'config.json' file can be found at:
https://www.balena.io/docs/reference/OS/configuration/

Examples:

	$ balena config inject my/config.json
	$ balena config inject my/config.json --drive /dev/disk2

### Arguments

#### FILE

the path to the config.json file to inject

### Options

#### -d, --drive DRIVE

path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)

## config read

Read the 'config.json' file of a balenaOS image file or attached SD card or
USB stick.

Documentation for the balenaOS 'config.json' file can be found at:
https://www.balena.io/docs/reference/OS/configuration/

Examples:

	$ balena config read
	$ balena config read --drive /dev/disk2
	$ balena config read --drive balena.img

### Options

#### -d, --drive DRIVE

path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)

#### -j, --json

produce JSON output instead of tabular output

## config reconfigure

Interactively reconfigure a balenaOS image file or attached media.

This command extracts the device UUID from the 'config.json' file of the
chosen balenaOS image file or attached media, and then passes the UUID as
the '--device' argument to the 'balena os configure' command.

For finer-grained or scripted control of the operation, use the
'balena config read' and 'balena os configure' commands separately.

Examples:

	$ balena config reconfigure
	$ balena config reconfigure --drive /dev/disk3
	$ balena config reconfigure --drive balena.img --advanced

### Options

#### -d, --drive DRIVE

path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)

#### -v, --advanced

show advanced commands

#### --version VERSION

balenaOS version, for example "2.32.0" or "2.44.0+rev1"

## config write &#60;key&#62; &#60;value&#62;

Write a key-value pair to the 'config.json' file of a balenaOS image file or
attached SD card or USB stick.

Documentation for the balenaOS 'config.json' file can be found at:
https://www.balena.io/docs/reference/OS/configuration/

Examples:

	$ balena config write ntpServers "0.resinio.pool.ntp.org 1.resinio.pool.ntp.org"
	$ balena config write --drive /dev/disk2 hostname custom-hostname
	$ balena config write --drive balena.img os.network.connectivity.interval 300

### Arguments

#### KEY

the key of the config parameter to write

#### VALUE

the value of the config parameter to write

### Options

#### -d, --drive DRIVE

path to OS image file (e.g. balena.img) or block device (e.g. /dev/disk2)

# Preload

## preload &#60;image&#62;

Preload a release (service images/containers) from a balena fleet, and optionally
a balenaOS splash screen, in a previously downloaded '.img' balenaOS image file
in the local disk (a zip file is only accepted for the Intel Edison device type).
After preloading, the balenaOS image file can be flashed to a device's SD card.
When the device boots, it will not need to download the release, as it was
preloaded. This is usually combined with release pinning
(https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/)
to avoid the device downloading a newer release straight away, if available.
Check also the Preloading and Preregistering section of the balena CLI's advanced
masterclass document:
https://www.balena.io/docs/learn/more/masterclasses/advanced-cli/#5-preloading-and-preregistering

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Note that the this command requires Docker to be installed, as further detailed
in the balena CLI's installation instructions:
https://github.com/balena-io/balena-cli/blob/master/INSTALL.md
The `--dockerHost` and `--dockerPort` flags allow a remote Docker engine to
be used, however the image file must be accessible to the remote Docker engine
on the same path given on the command line. This is because Docker's bind mount
feature is used to "share" the image with a container that performs the preload.

Examples:

	$ balena preload balena.img --fleet MyFleet --commit e1f2592fc6ee949e68756d4f4a48e49bff8d72a0
	$ balena preload balena.img --fleet myorg/myfleet --splash-image image.png
	$ balena preload balena.img

### Arguments

#### IMAGE

the image file path

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -c, --commit COMMIT

The commit hash of the release to preload. Use "current" to specify the current
release (ignored if no appId is given). The current release is usually also the
latest, but can be pinned to a specific release. See:  
https://www.balena.io/docs/learn/deploy/release-strategy/release-policy/  
https://www.balena.io/docs/learn/more/masterclasses/fleet-management/#63-pin-using-the-api  
https://github.com/balena-io-examples/staged-releases

#### -s, --splash-image SPLASH-IMAGE

path to a png image to replace the splash screen

#### --dont-check-arch

disable architecture compatibility check between image and fleet

#### -p, --pin-device-to-release

pin the preloaded device to the preloaded release on provision

#### --additional-space ADDITIONAL-SPACE

expand the image by this amount of bytes instead of automatically estimating the required amount

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

## push &#60;fleetOrDevice&#62;

Build release images on balenaCloud servers or on a local mode device.

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
daemon or balenaEngine.  In a microservices (multicontainer) fleet, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) fleets that define a docker-compose.yml file. When this
option is used, each service subdirectory (defined by the `build` or
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
together, and cannot override or extend other files. This behavior maximizes
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI v11 also took .gitignore files into account. This behavior was
deprecated in CLI v12 and removed in CLI v13. Please use .dockerignore files
instead.

Default .dockerignore patterns  
A few default/hardcoded dockerignore patterns are "merged" (in memory) with the
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
adding exception patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Note: the --service and --env flags must come after the fleetOrDevice
parameter, as per examples.

Examples:

	$ balena push myFleet
	$ balena push myFleet --source <source directory>
	$ balena push myFleet -s <source directory>
	$ balena push myFleet --source <source directory> --note "this is the note for this release"
	$ balena push myFleet --release-tag key1 "" key2 "value2 with spaces"
	$ balena push myorg/myfleet
	
	$ balena push 10.0.0.1
	$ balena push 10.0.0.1 --source <source directory>
	$ balena push 10.0.0.1 --service my-service
	$ balena push 10.0.0.1 --env MY_ENV_VAR=value --env my-service:SERVICE_VAR=value
	$ balena push 10.0.0.1 --nolive
	
	$ balena push 23c73a1.local --system
	$ balena push 23c73a1.local --system --service my-service

### Arguments

#### FLEETORDEVICE

fleet name or slug, or local device IP address or ".local" hostname

### Options

#### -s, --source SOURCE

Source directory to be sent to balenaCloud or balenaOS device
(default: current working dir)

#### -e, --emulated

Don't use the faster, native balenaCloud ARM builders; force slower QEMU ARM
emulation on Intel x86-64 builders. This flag is sometimes used to investigate
suspected issues with the balenaCloud backend.

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
this flag and --detached are required to cause the process to end once the
initial build has completed.

#### -d, --detached

When pushing to the cloud, this option will cause the build to start, then
return execution back to the shell, with the status and release ID (if
applicable).  When pushing to a local mode device, this option will cause
the command to not tail logs when the build has completed.

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

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help push".

#### --release-tag RELEASE-TAG

Set release tags if the image build is successful (balenaCloud only). Multiple
arguments may be provided, alternating tag keys and values (see examples).
Hint: Empty values may be specified with "" (bash, cmd.exe) or '""' (PowerShell).

#### --draft

Instruct the builder to create the release as a draft. Draft releases are ignored
by the 'track latest' release policy but can be used through release pinning.
Draft releases can be marked as final through the API. Releases are created
as final by default unless this option is given.

#### --note NOTE

The notes for this release

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

You must specify either a fleet, or the device type and architecture.

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
daemon or balenaEngine.  In a microservices (multicontainer) fleet, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) fleets that define a docker-compose.yml file. When this
option is used, each service subdirectory (defined by the `build` or
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
together, and cannot override or extend other files. This behavior maximizes
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI v11 also took .gitignore files into account. This behavior was
deprecated in CLI v12 and removed in CLI v13. Please use .dockerignore files
instead.

Default .dockerignore patterns  
A few default/hardcoded dockerignore patterns are "merged" (in memory) with the
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
adding exception patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Examples:

	$ balena build --fleet myFleet
	$ balena build ./source/ --fleet myorg/myfleet
	$ balena build --deviceType raspberrypi3 --arch armv7hf --emulated
	$ balena build --docker /var/run/docker.sock --fleet myFleet   # Linux, Mac
	$ balena build --docker //./pipe/docker_engine --fleet myFleet # Windows
	$ balena build --dockerHost my.docker.host --dockerPort 2376 --ca ca.pem --key key.pem --cert cert.pem -f myFleet

### Arguments

#### SOURCE

path of project source directory

### Options

#### -A, --arch ARCH

the architecture to build for

#### -d, --deviceType DEVICETYPE

the type of device this build is for

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -e, --emulated

Use QEMU for ARM architecture emulation during the image build

#### --dockerfile DOCKERFILE

Alternative Dockerfile name/path, relative to the source folder

#### --nologs

Hide the image build log output (produce less verbose output)

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help build".

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### -R, --registry-secrets REGISTRY-SECRETS

Path to a YAML or JSON file with passwords for a private Docker registry

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -n, --projectName PROJECTNAME

Name prefix for locally built images. This is the 'projectName' portion
in 'projectName_serviceName:tag'. The default is the directory name.

#### -t, --tag TAG

Tag locally built Docker images. This is the 'tag' portion
in 'projectName_serviceName:tag'. The default is 'latest'.

#### -B, --buildArg BUILDARG

[Deprecated] Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

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

## deploy &#60;fleet&#62; [image]

Usage: `deploy <fleet> ([image] | --build [--source build-dir])`

Use this command to deploy an image or a complete multicontainer project to a
fleet, optionally building it first. The source images are searched for
(and optionally built) using the docker daemon in your development machine or
balena device. (See also the `balena push` command for the option of building
the image in the balenaCloud build servers.)

Unless an image is specified, this command will look into the current directory
(or the one specified by --source) for a docker-compose.yml file.  If one is
found, this command will deploy each service defined in the compose file,
building it first if an image for it doesn't exist. Image names will be looked
up according to the scheme: `<projectName>_<serviceName>`.

If a compose file isn't found, the command will look for a Dockerfile[.template]
file (or alternative Dockerfile specified with the `-f` option), and if yet
that isn't found, it will try to generate one.

To deploy to a fleet where you are a collaborator, use fleet slug including the
organization:  `balena deploy <organization>/<fleet>`.

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
daemon or balenaEngine.  In a microservices (multicontainer) fleet, the
source directory is the directory that contains the "docker-compose.yml" file.

The --multi-dockerignore (-m) option may be used with microservices
(multicontainer) fleets that define a docker-compose.yml file. When this
option is used, each service subdirectory (defined by the `build` or
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
together, and cannot override or extend other files. This behavior maximizes
compatibility with the standard docker-compose tool, while still allowing a
root .dockerignore file (at the overall project root) to filter files and
folders that are outside service subdirectories.

balena CLI v11 also took .gitignore files into account. This behavior was
deprecated in CLI v12 and removed in CLI v13. Please use .dockerignore files
instead.

Default .dockerignore patterns  
A few default/hardcoded dockerignore patterns are "merged" (in memory) with the
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
adding exception patterns to the applicable .dockerignore file(s), for example
`!mysubmodule/.git`. For documentation on pattern format, see:
- https://docs.docker.com/engine/reference/builder/#dockerignore-file
- https://www.npmjs.com/package/@balena/dockerignore

Examples:

	$ balena deploy myFleet
	$ balena deploy myorg/myfleet --build --source myBuildDir/
	$ balena deploy myorg/myfleet --build --source myBuildDir/ --note "this is the note for this release"
	$ balena deploy myorg/myfleet myRepo/myImage
	$ balena deploy myFleet myRepo/myImage --release-tag key1 "" key2 "value2 with spaces"

### Arguments

#### FLEET

fleet name or slug (preferred)

#### IMAGE

the image to deploy

### Options

#### -s, --source SOURCE

specify an alternate source directory; default is the working directory

#### -b, --build

force a rebuild before deploy

#### --nologupload

don't upload build logs to the dashboard with image (if building)

#### --release-tag RELEASE-TAG

Set release tags if the image deployment is successful. Multiple
arguments may be provided, alternating tag keys and values (see examples).
Hint: Empty values may be specified with "" (bash, cmd.exe) or '""' (PowerShell).

#### --draft

Deploy the release as a draft. Draft releases are ignored
by the 'track latest' release policy but can be used through release pinning.
Draft releases can be marked as final through the API. Releases are created
as final by default unless this option is given.

#### --note NOTE

The notes for this release

#### -e, --emulated

Use QEMU for ARM architecture emulation during the image build

#### --dockerfile DOCKERFILE

Alternative Dockerfile name/path, relative to the source folder

#### --nologs

Hide the image build log output (produce less verbose output)

#### -m, --multi-dockerignore

Have each service use its own .dockerignore file. See "balena help build".

#### --noparent-check

Disable project validation check of 'docker-compose.yml' file in parent folder

#### -R, --registry-secrets REGISTRY-SECRETS

Path to a YAML or JSON file with passwords for a private Docker registry

#### --noconvert-eol

Don't convert line endings from CRLF (Windows format) to LF (Unix format).

#### -n, --projectName PROJECTNAME

Name prefix for locally built images. This is the 'projectName' portion
in 'projectName_serviceName:tag'. The default is the directory name.

#### -t, --tag TAG

Tag locally built Docker images. This is the 'tag' portion
in 'projectName_serviceName:tag'. The default is 'latest'.

#### -B, --buildArg BUILDARG

[Deprecated] Set a build-time variable (eg. "-B 'ARG=value'"). Can be specified multiple times.

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

Move a local device to a fleet on another balena server, causing
the device to "join" the new server. The device must be running balenaOS.

For example, you could provision a device against an openBalena installation
where you perform end-to-end tests and then move it to balenaCloud when it's
ready for production.

To move a device between fleets on the same server, use the
`balena device move` command instead of `balena join`.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This may require administrator/root privileges.
Likewise, if the fleet option is not provided then a picker will be shown.

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	$ balena join
	$ balena join balena.local
	$ balena join balena.local --fleet MyFleet
	$ balena join balena.local -f myorg/myfleet
	$ balena join 192.168.1.25
	$ balena join 192.168.1.25 --fleet MyFleet

### Arguments

#### DEVICEIPORHOSTNAME

the IP or hostname of device

### Options

#### -f, --fleet FLEET

fleet name or slug (preferred)

#### -i, --pollInterval POLLINTERVAL

the interval in minutes to check for updates

## leave [deviceIpOrHostname]

Remove a local device from its balena fleet, causing the device to
"leave" the server it is provisioned on. This effectively makes the device
"unmanaged". The device must be running balenaOS.

The device entry on the server is preserved after running this command,
so the device can subsequently re-join the server if needed.

If you don't specify a device hostname or IP, this command will automatically
scan the local network for balenaOS devices and prompt you to select one
from an interactive picker. This may require administrator/root privileges.

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

Grant or revoke balena support agent access to devices or fleets
on balenaCloud. (This command does not apply to openBalena.)
Access will be automatically revoked once the specified duration has elapsed.

Duration defaults to 24h, but can be specified using --duration flag in days
or hours, e.g. '12h', '2d'.

Both --device and --fleet flags accept multiple values, specified as
a comma-separated list (with no spaces).

Fleets may be specified by fleet name or slug. Fleet slugs are
the recommended option, as they are unique and unambiguous. Slugs can be
listed with the `balena fleets` command. Note that slugs may change if the
fleet is renamed. Fleet names are not unique and may result in  "Fleet is
ambiguous" errors at any time (even if it "used to work in the past"), for
example if the name clashes with a newly created public fleet, or with fleets
from other balena accounts that you may be invited to join under any role.
For this reason, fleet names are especially discouraged in scripts (e.g. CI
environments).

Examples:

	balena support enable --device ab346f,cd457a --duration 3d
	balena support enable --fleet myFleet --duration 12h
	balena support disable -f myorg/myfleet

### Arguments

#### ACTION

enable|disable support access

### Options

#### -d, --device DEVICE

comma-separated list (no spaces) of device UUIDs

#### -f, --fleet FLEET

comma-separated list (no spaces) of fleet names or slugs (preferred)

#### -t, --duration DURATION

length of time to enable support for, in (h)ours or (d)ays, e.g. 12h, 2d
