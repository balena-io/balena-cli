Resin CLI
=========

> The official Resin CLI tool.

[![npm version](https://badge.fury.io/js/resin-cli.svg)](http://badge.fury.io/js/resin-cli)
[![dependencies](https://david-dm.org/resin-io/resin-cli.svg)](https://david-dm.org/resin-io/resin-cli)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/resin-io/chat)

Requisites
----------

- [NodeJS](https://nodejs.org) (>= v4)
- [Git](https://git-scm.com)
- The following executables should be correctly installed in your shell environment:
  - `ssh`: Any recent version of the OpenSSH ssh client (required by `resin sync` and `resin ssh`)
	- if you need `ssh` to work behind the proxy you also need [`proxytunnel`](http://proxytunnel.sourceforge.net/) installed (available as `proxytunnel` package for Ubuntu, for example)
  - `rsync`: >= 2.6.9 (required by `resin sync`)

##### Windows Support

`resin sync` and `resin ssh` have not been thoroughly tested on the standard Windows cmd.exe shell. We recommend using bash (or a similar) shell, like Bash for Windows 10 or [Git for Windows](https://git-for-windows.github.io/).

If you still want to use `cmd.exe` you will have to use a package manager like MinGW or chocolatey. For MinGW the steps are:

1. Install [MinGW](http://www.mingw.org).
2. Install the `msys-rsync` and `msys-openssh` packages.
3. Add MinGW to the `%PATH%` if this hasn't been done by the installer already. The location where the binaries are places is usually `C:\MinGW\msys\1.0\bin`, but it can vary if you selected a different location in the installer.
4. Copy your SSH keys to `%homedrive%%homepath\.ssh`.
5. If you need `ssh` to work behind the proxy you also need to install [proxytunnel](http://proxytunnel.sourceforge.net/)

Getting Started
---------------

### Installing

This might require elevated privileges in some environments.

```sh
$ npm install --global --production resin-cli
```

### List available commands

```sh
$ resin help
```

### Run the quickstart wizard

```sh
$ resin quickstart
```

Plugins
-------

The Resin CLI can be extended with plugins to automate laborious tasks and overall provide a better experience when working with Resin.io. Check the [plugin development tutorial](https://github.com/resin-io/resin-plugin-hello) to learn how to build your own!

FAQ
---

### Where is my configuration file?

The per-user configuration file lives in `$HOME/.resinrc.yml` or `%UserProfile%\_resinrc.yml`, in Unix based operating systems and Windows respectively.

The Resin CLI also attempts to read a `resinrc.yml` file in the current directory, which takes precedence over the per-user configuration file.

### How do I point the Resin CLI to staging?

The easiest way is to set the `RESINRC_RESIN_URL=resinstaging.io` environment variable.

Alternatively, you can edit your configuration file and set `resinUrl: resinstaging.io` to persist this setting.

### How do I make the Resin CLI persist data in another directory?

The Resin CLI persists your session token, as well as cached images in `$HOME/.resin` or `%UserProfile%\_resin`.

Pointing the Resin CLI to persist data in another location is necessary in certain environments, like a server, where there is no home directory, or a device running Resin OS, which erases all data after a restart.

You can accomplish this by setting `RESINRC_DATA_DIRECTORY=/opt/resin` or adding `dataDirectory: /opt/resin` to your configuration file, replacing `/opt/resin` with your desired directory.

Support
-------

If you're having any problems, check our [troubleshooting guide](https://github.com/resin-io/resin-cli/blob/master/TROUBLESHOOTING.md) and if your problem is not addressed there, please [raise an issue](https://github.com/resin-io/resin-cli/issues/new) on GitHub and the resin.io team will be happy to help.

You can also get in touch with us in the resin.io [forums](https://forums.resin.io/).

License
-------

The project is licensed under the Apache 2.0 license.
