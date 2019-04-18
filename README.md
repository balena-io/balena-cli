balena CLI
=========

> The official balena CLI tool.

[![npm version](https://badge.fury.io/js/balena-cli.svg)](http://badge.fury.io/js/balena-cli)
[![dependencies](https://david-dm.org/balena-io/balena-cli.svg)](https://david-dm.org/balena-io/balena-cli)
[![Gitter](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/balena-io/chat)

Getting Started
---------------

The easiest and recommended way of installing the CLI on all platforms (Linux, MacOS, Windows)
is to use the Standalone Install described below. Some specific CLI commands like `balena ssh`
and `balena sync` have additional dependencies: see section Additional Dependencies.

> **Windows users:** we now have a [YouTube video tutorial](https://www.youtube.com/watch?v=j3JoA1EINUA)
for installing and getting started with the balena CLI on Windows!

### Standalone install

* Download the latest zip for your OS from https://github.com/balena-io/balena-cli/releases.
* Extract the contents, putting the `balena-cli` folder somewhere appropriate for your system (e.g. `C:/balena-cli`, `/usr/local/lib/balena-cli`, etc).
* Add the `balena-cli` folder to your `PATH` ([Windows instructions](https://www.computerhope.com/issues/ch000549.htm), [Linux instructions](https://stackoverflow.com/questions/14637979/how-to-permanently-set-path-on-linux-unix), [OSX instructions](https://stackoverflow.com/questions/22465332/setting-path-environment-variable-in-osx-permanently))
* Running `balena` in a fresh command line should print the balena CLI help. See Windows Support
section below for some notes regarding the shell.

To update the CLI to a new version, simply download a new release and replace the extracted folder.

### NPM install

If you are a Node.js developer, you may wish to install the balena CLI through npm[https://www.npmjs.com]. The npm installation involves building native (platform-specific) binary modules, for which there are some pre-requisites:

* Node.js version 6 or above (**soon version 8 or above**)
* Python 2.7
* g++ compiler
* make
* git
* Under Windows, the `windows-build-tools` npm package should be installed too, running the
  following command in an administrator console (available as 'Command Prompt (Admin)' when
  pressing Windows+X in Windows 7+) :  
  `npm install -g --production windows-build-tools`

With those in place, the CLI installation command is:

```sh
$ npm install balena-cli -g --production --unsafe-perm
```

`--unsafe-perm` is only required on systems where the global install directory is not user-writable.
This allows npm install steps to download and save prebuilt native binaries. You may be able to omit it,
especially if you're using a user-managed node install such as [nvm](https://github.com/creationix/nvm).

### Additional Dependencies

* The `balena ssh` command requires a recent version of the `ssh` command-line tool to be available:
  * MacOS and Linux usually already have it installed. Otherwise, search for the available
  packages on your specific Linux distribution, or for the Mac consider the [Xcode command-line
  tools](https://developer.apple.com/xcode/features/) or [homebrew](https://brew.sh/).

  * Microsoft released an OpenSSH version of ssh for Windows 10, which we understand is
  automatically installed through Windows Update, but can be manually installed too.
  More information [here](https://docs.microsoft.com/en-us/windows-server/administration/openssh/openssh_install_firstuse). For other versions of Windows, there are several ssh/OpenSSH clients
  provided by 3rd parties.

  * If you need `ssh` to work behind a proxy, you also need [`proxytunnel`](http://proxytunnel.sourceforge.net/) installed (available as `proxytunnel` package for Ubuntu, for example).

* The `balena sync` command currently requires `rsync` (>= 2.6.9) to be installed:
  * Linux: `apt-get install rsync`
  * MacOS: [Xcode command-line tools](https://developer.apple.com/xcode/features/) or [homebrew](https://brew.sh/)
  * Windows: use MinGW as described in the Windows Support section.

### Windows Support

We aim at supporting the standard Windows Command Prompt (`cmd.exe`) and the Windows [PowerShell](https://docs.microsoft.com/en-us/powershell/scripting/getting-started/getting-started-with-windows-powershell?view=powershell-6).

Some CLI commands like `balena sync` and `balena ssh` have not been thoroughly tested with the standard Windows shells. We are aware of users having a good experience with alternative shells, including:

* Microsoft's [Windows Subsystem for Linux](https://docs.microsoft.com/en-us/windows/wsl/about) (a.k.a. Microsoft's "bash for Windows 10").
* [Git for Windows](https://git-for-windows.github.io/).
* [MinGW](http://www.mingw.org)
  1. Install [MinGW](http://www.mingw.org).
  2. Install the `msys-rsync` and `msys-openssh` packages.
  3. Add MinGW to the `%PATH%` if this hasn't been done by the installer already. The location where the binaries are places is usually `C:\MinGW\msys\1.0\bin`, but it can vary if you selected a different location in the installer.
  4. Copy your SSH keys to `%homedrive%%homepath\.ssh`.
  5. If you need `ssh` to work behind the proxy you also need to install [proxytunnel](http://proxytunnel.sourceforge.net/)

### Login

```sh
$ balena login
```

_(Typically useful, but not strictly required for all commands)_

### Run commands

Take a look at the full command documentation at [https://balena.io/docs/tools/cli/](https://balena.io/docs/tools/cli/#table-of-contents
), or by running `balena help`.

### Bash completions

Optionally you can enable tab completions for the bash shell, enabling the shell to provide additional context and automatically complete arguments to`balena`. To enable bash completions, copy the `balena-completion.bash` file to the default bash completions directory (usually `/etc/bash_completion.d/`) or append it to the end of `~/.bash_completion`.

FAQ
---

### Where is my configuration file?

The per-user configuration file lives in `$HOME/.balenarc.yml` or `%UserProfile%\_balenarc.yml`, in Unix based operating systems and Windows respectively.

The balena CLI also attempts to read a `balenarc.yml` file in the current directory, which takes precedence over the per-user configuration file.

### How do I point the balena CLI to staging?

The easiest way is to set the `BALENARC_BALENA_URL=balena-staging.com` environment variable.

Alternatively, you can edit your configuration file and set `balenaUrl: balena-staging.com` to persist this setting.

### How do I make the balena CLI persist data in another directory?

The balena CLI persists your session token, as well as cached images in `$HOME/.balena` or `%UserProfile%\_balena`.

Pointing the balena CLI to persist data in another location is necessary in certain environments, like a server, where there is no home directory, or a device running balenaOS, which erases all data after a restart.

You can accomplish this by setting `BALENARC_DATA_DIRECTORY=/opt/balena` or adding `dataDirectory: /opt/balena` to your configuration file, replacing `/opt/balena` with your desired directory.

Support
-------

If you're having any problems or would like to get in touch:

* Check our [troubleshooting guide](https://github.com/balena-io/balena-cli/blob/master/TROUBLESHOOTING.md)
* Ask us a question through the balenaCloud forum: https://forums.balena.io/c/balena-cloud
* For bug reports or feature requests, have a look at the GitHub issues or
create a new one at: https://github.com/balena-io/balena-cli/issues/

Development guidelines
----------------------

The CLI was originally written in [CoffeeScript](https://coffeescript.org), but we have decided to
migrate to [TypeScript](https://www.typescriptlang.org/) in order to take advantage of static
typing and formal programming interfaces. The migration is taking place gradually, as part of
maintenance work or the implementation of new features.

After cloning this repository and running `npm install` you can build the CLI using `npm run build`.
You can then run the generated build using `./bin/balena`.
In order to ease development:
* you can build the CLI using the `npm run build:fast` variant which skips some of the build steps or
* you can use `./bin/balena-dev` which live transpiles the sources of the CLI.

In either case, before opening a PR make sure to also test your changes after doing a full build with `npm run build`.

License
-------

The project is licensed under the Apache 2.0 license.
