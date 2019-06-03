# balena CLI

The official balena CLI tool.

[![npm version](https://badge.fury.io/js/balena-cli.svg)](http://badge.fury.io/js/balena-cli)
[![dependencies](https://david-dm.org/balena-io/balena-cli.svg)](https://david-dm.org/balena-io/balena-cli)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/balena-io/chat)

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

* Microsoft's [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about)
  (a.k.a. Microsoft's "bash for Windows 10")
* [Git for Windows](https://git-for-windows.github.io/)
* [MSYS](http://www.mingw.org/wiki/MSYS) and [MSYS2](https://www.msys2.org/) (install the
  `msys-rsync` and `msys-openssh` packages too)

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

* Set the `BALENARC_PROXY` environment variable in URL format (with protocol, host, port, and
  optionally basic auth).
* Alternatively, use the [balena config file](https://www.npmjs.com/package/balena-settings-client#documentation)
  (project-specific or user-level) and set the `proxy` setting. It can be:
  * A string in URL format, or
  * An object in the [global-tunnel-ng options format](https://www.npmjs.com/package/global-tunnel-ng#options) (which allows more control).
* Alternatively, set the conventional `https_proxy` / `HTTPS_PROXY` / `http_proxy` / `HTTP_PROXY`
  environment variable (in the same standard URL format).

To get a proxy to work with the `balena ssh` command, check the
[installation instructions](https://github.com/balena-io/balena-cli/blob/master/INSTALL.md).

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
