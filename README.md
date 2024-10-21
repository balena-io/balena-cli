# balena CLI

The official balena Command Line Interface.

[![npm version](https://badge.fury.io/js/balena-cli.svg)](http://badge.fury.io/js/balena-cli)
[![dependencies](https://david-dm.org/balena-io/balena-cli.svg)](https://david-dm.org/balena-io/balena-cli)

## About

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

### Proxy setup for balena device ssh

In order to work behind a proxy server, the `balena device ssh` command requires the
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
> * To exclude a `balena device ssh` target from proxying (IP address or `.local` hostname), the
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

## Command reference documentation

The full CLI command reference is available [on the web](https://www.balena.io/docs/reference/cli/
) or by running `balena help --verbose`.

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

## Contributing (including editing documentation files)

Please have a look at the [CONTRIBUTING.md](./CONTRIBUTING.md) file for some guidance before
submitting a pull request or updating documentation (because some files are automatically
generated). Thank you for your help and interest!

## License

The project is licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
A copy is also available in the LICENSE file in this repository.
