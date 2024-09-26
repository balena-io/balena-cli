# balena CLI FAQ & Troubleshooting

## Where is the balena CLI's configuration file located?

The per-user configuration file lives in `$HOME/.balenarc.yml` or `%UserProfile%\_balenarc.yml`, in
Unix based operating systems and Windows respectively.

The balena CLI also attempts to read a `balenarc.yml` file in the current directory, which takes
precedence over the per-user configuration file.

## How do I point the balena CLI to the staging environment?

Set the `BALENARC_BALENA_URL=balena-staging.com` environment variable, or add
`balenaUrl: balena-staging.com` to the balena CLI's configuration file.

## How do I make the balena CLI persist data in another directory?

The balena CLI persists the session token, as well as cached assets, to `$HOME/.balena` or
`%UserProfile%\_balena`. This directory can be changed by setting an environment variable,
`BALENARC_DATA_DIRECTORY=/opt/balena`, or by adding `dataDirectory: /opt/balena` to the CLI's
configuration file, replacing `/opt/balena` with the desired directory.

## After burning to an SD card, my device doesn't boot

Check whether the downloaded image is incomplete (download was interrupted) or corrupted.

Try clearing the cache (`%HOME/.balena/cache` or `C:\Users\<user>\_balena\cache`) and running the
command again.

## I get a permission error when burning to an SD card

Check whether the SD card is locked (a physical switch on the side of the card).

## I get `connect ETIMEDOUT` with `balena device tunnel`

Please update the CLI to the latest version. This issue was fixed in v12.38.5.
For more details, see: https://github.com/balena-io/balena-cli/issues/2172

## I get EINVAL errors on Cygwin

The errors may look something like this:

```
net.js:156
    this._handle.open(options.fd);
                 ^
Error: EINVAL, invalid argument
```

Some interactive widgets don't work on `Cygwin`. On Windows, PowerShell or `cmd.exe` are better
supported. Alternative shells are [listed in the README
file](./README.md#choosing-a-shell-command-promptterminal).

## I get `Invalid MBR boot signature` when configuring a device

This error, accompanied with something like: `Expected 0xAA55, but saw 0x29FE` usually indicates a corrupted device operating system image in the cache, due to bad a internet connection during the download process.

Try clearing the cache with the following command and trying again:

```sh
$ rm -rf $HOME/.balena/cache
```

Or in Windows:

```sh
> del /s /q %UserProfile%\_balena\cache
```

## I get `EACCES: permission denied` when logging in

The balena CLI stores the session token in `$HOME/.balena` or `C:\Users\<user>\_balena` in UNIX based
operating systems and Windows respectively. This error usually indicates that the user doesn't have
permissions over that directory, which can happen if the CLI was executed as the `root` user.

Try resetting the ownership by running:

```sh
$ sudo chown -R <user> $HOME/.balena
```

## Broken line wrapping / cursor behavior with `balena device ssh`

Users sometimes come across broken line wrapping or cursor behavior in text terminals, for example
when long command lines are typed in a `balena device ssh` session, or when using text editors like `vim`
or `nano`. This is not something specific to the balena CLI, being also a commonly reported issue
with standard remote terminal tools like `ssh` or `telnet`.  It is often a remote shell
configuration issue (files like `/etc/profile`, `~/.bash_profile`, `~/.bash_login`, `~/.profile`
and the like on the remote machine), including UTF-8 misconfiguration, the use of unsupported ASCII
control characters in shell prompt formatting (e.g. the `$PS1` env var) or the output of tools or
log files that use colored text. The issue can sometimes be fixed by simply resizing the client
terminal window, or by running one or more of the following commands on the shell:

```sh
export TERMINAL=linux
stty sane
shopt -s checkwinsize
bind 'set horizontal-scroll-mode off'
```

Terminal multiplexer tools like GNU `screen` or `tmux` are sometimes reported to fix the issues, though at other times they are reported as the _cause_ of the problem. They have their own configuration files to take into account.

Further reference:
* https://stackoverflow.com/questions/1133031/shell-prompt-line-wrapping-issue
* https://superuser.com/questions/46948/any-way-to-fix-screens-mishandling-of-line-wrap-maybe-only-terminal-app
* https://unix.stackexchange.com/questions/105958/terminal-prompt-not-wrapping-correctly
* https://unix.stackexchange.com/questions/529377/terminal-long-line-wrapping
* https://github.com/microsoft/WSL/issues/1436

If nothing seems to help, consider also using a different client-side terminal application:
* Linux: xterm, KDE Konsole, GNOME Terminal
* Mac: Terminal, iTerm2
* Windows: PowerShell, PuTTY, WSL (Windows Subsystem for Linux)

## "Docker seems to be unavailable" error when using Windows Subsystem for Linux (WSL)

When running on WSL, the recommendation is to install a CLI release for Linux, like the standalone
zip package for Linux. However, commands like "balena build" will, by default, attempt to reach the
Docker daemon at the Unix socket path `/var/run/docker.sock`, while Docker Desktop for Windows uses
a Windows named pipe at `//./pipe/docker_engine` (which the Linux CLI on WSL cannot use). A
solution is:

- Open the Docker Desktop for Windows settings panel and tick the checkbox _"Expose daemon on tcp://localhost:2375 without TLS"._
- On the WSL command line, set an env var:  
`export DOCKER_HOST=tcp://localhost:2375`  
Alternatively, use the command-line options `-h 127.0.0.1 -p 2375` for commands like `balena build` and `balena deploy`.

Further reference:

- https://techcommunity.microsoft.com/t5/Containers/WSL-Interoperability-with-Docker/ba-p/382405
- https://forums.docker.com/t/wsl-and-docker-for-windows-cannot-connect-to-the-docker-daemon-at-tcp-localhost-2375-is-the-docker-daemon-running/63571/12
