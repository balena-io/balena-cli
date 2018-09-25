Resin CLI
=========

> The official resin.io CLI tool.

[![npm version](https://badge.fury.io/js/resin-cli.svg)](http://badge.fury.io/js/resin-cli)
[![dependencies](https://david-dm.org/resin-io/resin-cli.svg)](https://david-dm.org/resin-io/resin-cli)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/resin-io/chat)

Requisites
----------

If you want to install the CLI directly through npm, you'll need the below. If this looks difficult,
we do now have an experimental standalone binary release available, see ['Standalone install'](#standalone-install) below.

- [NodeJS](https://nodejs.org) (>= v6)
- [Git](https://git-scm.com)
- The following executables should be correctly installed in your shell environment:
  - `ssh`: Any recent version of the OpenSSH ssh client (required by `resin sync` and `resin ssh`)
	- if you need `ssh` to work behind the proxy you also need [`proxytunnel`](http://proxytunnel.sourceforge.net/) installed (available as `proxytunnel` package for Ubuntu, for example)
  - `rsync`: >= 2.6.9 (required by `resin sync`)

##### Windows Support

Before installing resin-cli, you'll need a working node-gyp environment. If you don't already have one you'll see native module build errors during installation. To fix this, run `npm install -g --production windows-build-tools` in an administrator console (available as 'Command Prompt (Admin)' when pressing windows+x in Windows 7+).

`resin sync` and `resin ssh` have not been thoroughly tested on the standard Windows cmd.exe shell. We recommend using bash (or a similar) shell, like Bash for Windows 10 or [Git for Windows](https://git-for-windows.github.io/).

If you still want to use `cmd.exe` you will have to use a package manager like MinGW or chocolatey. For MinGW the steps are:

1. Install [MinGW](http://www.mingw.org).
2. Install the `msys-rsync` and `msys-openssh` packages.
3. Add MinGW to the `%PATH%` if this hasn't been done by the installer already. The location where the binaries are places is usually `C:\MinGW\msys\1.0\bin`, but it can vary if you selected a different location in the installer.
4. Copy your SSH keys to `%homedrive%%homepath\.ssh`.
5. If you need `ssh` to work behind the proxy you also need to install [proxytunnel](http://proxytunnel.sourceforge.net/)

Getting Started
---------------

### NPM install

If you've got all the requirements above, you should be able to install the CLI directly from npm. If not,
or if you have any trouble with this, please try the new standalone install steps just below.

This might require elevated privileges in some environments.

```sh
$ npm install resin-cli -g --production --unsafe-perm
```

`--unsafe-perm` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

In some environments, this process will need to build native modules. This may require a more complex build
environment, and notably requires Python 2.7. If you hit any problems with this, we recommend you try the
alternative standalone install below instead.

### Standalone install

If you don't have node or a working pre-gyp environment, you can still install the CLI as a standalone
binary. **This is experimental and may not work perfectly yet in all environments**, but it seems to work
well in initial cross-platform testing, so it may be useful, and we'd love your feedback if you hit any issues.

To install the CLI as a standalone binary:

* Download the latest zip for your OS from https://github.com/resin-io/resin-cli/releases.
* Extract the contents, putting the `resin-cli` folder somewhere appropriate for your system (e.g. `C:/resin-cli`, `/usr/local/lib/resin-cli`, etc).
* Add the `resin-cli` folder to your `PATH` ([Windows instructions](https://www.computerhope.com/issues/ch000549.htm), [Linux instructions](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix), [OSX instructions](https://stackoverflow.com/questions/22465332/setting-path-environment-variable-in-osx-permanently))
* Running `resin` in a fresh command line should print the resin CLI help.

To update in future, simply download a new release and replace the extracted folder.

Have any problems, or see any unexpected behaviour? [Please file an issue!](https://github.com/resin-io/resin-cli/issues/new)

### Login

```sh
$ resin login
```

_(Typically useful, but not strictly required for all commands)_

### Run commands

Take a look at the full command documentation at [https://docs.resin.io/tools/cli/](https://docs.resin.io/tools/cli/#table-of-contents
), or by running `resin help`.

### Bash completions

Optionally you can enable tab completions for the bash shell, enabling the shell to provide additional context and automatically complete arguments to`resin`. To enable bash completions, copy the `resin-completion.bash` file to the default bash completions directory (usually `/etc/bash_completion.d/`) or append it to the end of `~/.bash_completion`.

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

Pointing the Resin CLI to persist data in another location is necessary in certain environments, like a server, where there is no home directory, or a device running resinOS, which erases all data after a restart.

You can accomplish this by setting `RESINRC_DATA_DIRECTORY=/opt/resin` or adding `dataDirectory: /opt/resin` to your configuration file, replacing `/opt/resin` with your desired directory.

Support
-------

If you're having any problems, check our [troubleshooting guide](https://github.com/resin-io/resin-cli/blob/master/TROUBLESHOOTING.md) and if your problem is not addressed there, please [raise an issue](https://github.com/resin-io/resin-cli/issues/new) on GitHub and the resin.io team will be happy to help.

You can also get in touch with us in the resin.io [forums](https://forums.resin.io/).

License
-------

The project is licensed under the Apache 2.0 license.
