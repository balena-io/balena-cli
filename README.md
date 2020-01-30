# balena CLI

The official balena CLI tool.

[![npm version](https://badge.fury.io/js/balena-cli.svg)](http://badge.fury.io/js/balena-cli)
[![dependencies](https://david-dm.org/balena-io/balena-cli.svg)](https://david-dm.org/balena-io/balena-cli)

## About

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
> Check the [installation instructions](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).

Some installations of the balena CLI also include support for the `BALENARC_NO_PROXY` environment
variable, which allows proxy exclusion patterns to be defined. The current support status is listed
below. Eventually, all installation types will have support for it.

OS | Installation type | BALENARC_NO_PROXY environment variable support
-- | ----------------- | ----------------------------------------------
Windows | standalone zip | Supported with CLI v11.24.0 and later
Windows | native/GUI     | Not supported
macOS   | standalone zip | Not supported
macOS   | native/GUI     | Supported with CLI v11.24.0 and later
Linux   | standalone zip | Not supported
Any     | npm            | Supported with Node.js >= v10.16.0 and CLI >= v11.24.0

The format of the `BALENARC_NO_PROXY` environment variable is a comma-separated list of patterns
that are matched against hostnames or IP addresses. For example:

```
export BALENARC_NO_PROXY='*.local,dev*.mycompany.com,192.168.*'
```

Matched patterns are excluded from proxying. Matching takes place _before_ name resolution, so a
pattern like `'192.168.*'` will **not** match a hostname like `proxy.company.com` even if the
hostname resolves to an IP address like `192.168.1.2`. Pattern matching expressions are documented
at [matcher](https://www.npmjs.com/package/matcher#usage).

By default, if BALENARC_NO_PROXY is not defined, all [private IPv4
addresses](https://en.wikipedia.org/wiki/Private_network) and `'*.local'` are excluded from
proxying. Other hostnames that may resolve to private IPv4 addresses are **not** excluded by
default, as matching takes place _before_ name resolution. In addition, `localhost` and `127.0.0.1`
are always excluded from proxying, regardless of the value of BALENARC_NO_PROXY. These default
exclusions only apply to the CLI installations where BALENARC_NO_PROXY is supported, as listed in
the table above.

## Command reference documentation

The full CLI command reference is available [on the web](https://www.balena.io/docs/reference/cli/
) or by running `balena help` and `balena help --verbose`.

## Support, FAQ and troubleshooting

If you come across any problems or would like to get in touch:

* Check our [FAQ / troubleshooting document](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md).
* Ask us a question through the [balenaCloud forum](https://forums.balena.io/c/balena-cloud).
* For bug reports or feature requests,
  [have a look at the GitHub issues or create a new one](https://github.com/balena-io/balena-cli/issues/).

## Contributing (including editing documentation files)

Please have a look at the [CONTRIBUTING.md](./CONTRIBUTING.md) file for some guidance before
submitting a pull request or updating documentation (because some files are automatically
generated). Thank you for your help and interest!

## License

The project is licensed under the [Apache 2.0 License](https://www.apache.org/licenses/LICENSE-2.0).
A copy is also available in the LICENSE file in this repository.
