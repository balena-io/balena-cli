# FAQ & Troubleshooting

This document contains some common issues, questions and answers related to the balena CLI.

## Where is my configuration file?

The per-user configuration file lives in `$HOME/.balenarc.yml` or `%UserProfile%\_balenarc.yml`, in
Unix based operating systems and Windows respectively.

The balena CLI also attempts to read a `balenarc.yml` file in the current directory, which takes
precedence over the per-user configuration file.

## How do I point the balena CLI to staging?

The easiest way is to set the `BALENARC_BALENA_URL=balena-staging.com` environment variable.

Alternatively, you can edit your configuration file and set `balenaUrl: balena-staging.com` to
persist this setting.

## How do I make the balena CLI persist data in another directory?

The balena CLI persists your session token, as well as cached images in `$HOME/.balena` or
`%UserProfile%\_balena`.

Pointing the balena CLI to persist data in another location is necessary in certain environments,
like a server, where there is no home directory, or a device running balenaOS, which erases all
data after a restart.

You can accomplish this by setting `BALENARC_DATA_DIRECTORY=/opt/balena` or adding `dataDirectory:
/opt/balena` to your configuration file, replacing `/opt/balena` with your desired directory.

## After burning to an sdcard, my device doesn't boot

- The downloaded image is not complete (download was interrupted).

Please clean the cache (`%HOME/.balena/cache` or `C:\Users\<user>\_balena\cache`) and run the command again. In the future, the CLI will check that the image is not complete and clean the cache for you.

## I get a permission error when burning to an sdcard

- The SDCard is locked.

### I get EINVAL errors on Cygwin

The errors look something like this:

```
net.js:156
    this._handle.open(options.fd);
                 ^
Error: EINVAL, invalid argument
  at new Socket (net.js:156:18)
  at process.stdin (node.js:664:19)
  at Object.Interface.createInterface (C:\cygwin\home\Juan Cruz Viotti\Projects\balena-cli\node_modules\inquirer\node_modules\readline2\index.js:31:43)
  at PromptUI.UI (C:\cygwin\home\Juan Cruz Viotti\Projects\balena-cli\node_modules\inquirer\lib\ui\baseUI.js:23:40)
  at new PromptUI (C:\cygwin\home\Juan Cruz Viotti\Projects\balena-cli\node_modules\inquirer\lib\ui\prompt.js:26:8)
  at Object.promptModule [as prompt] (C:\cygwin\home\Juan Cruz Viotti\Projects\balena-cli\node_modules\inquirer\lib\inquirer.js:27:14)
```

- Some interactive widgets don't work on `Cygwin`. If you're running Windows, it's preferrable that you use `cmd.exe`, as `Cygwin` is [not official supported by Node.js](https://github.com/chjj/blessed/issues/56#issuecomment-42671945).

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

The balena CLI stores the session token in `$HOME/.balena` or `C:\Users\<user>\_balena` in UNIX based operating systems and Windows respectively. This error usually indicates that the user doesn't have permissions over that directory, which can happen if you ran the balena CLI as `root`, and thus the directory got owned by him.

Try resetting the ownership by running:

```sh
$ sudo chown -R <user> $HOME/.balena
```
