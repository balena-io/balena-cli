Troubleshooting
===============

This document contains common issues related to the Resin CLI, and how to fix them.

### After burning to an sdcard, my device doesn't boot

- The downloaded image is not complete (download was interrupted).

Please clean the cache (`%HOME/.resin/cache` or `C:\Users\<user>\_resin\cache`) and run the command again. In the future, the CLI will check that the image is not complete and clean the cache for you.

### I get a permission error when burning to an sdcard

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
  at Object.Interface.createInterface (C:\cygwin\home\Juan Cruz Viotti\Projects\resin-cli\node_modules\inquirer\node_modules\readline2\index.js:31:43)
  at PromptUI.UI (C:\cygwin\home\Juan Cruz Viotti\Projects\resin-cli\node_modules\inquirer\lib\ui\baseUI.js:23:40)
  at new PromptUI (C:\cygwin\home\Juan Cruz Viotti\Projects\resin-cli\node_modules\inquirer\lib\ui\prompt.js:26:8)
  at Object.promptModule [as prompt] (C:\cygwin\home\Juan Cruz Viotti\Projects\resin-cli\node_modules\inquirer\lib\inquirer.js:27:14)
```

- Some interactive widgets don't work on `Cygwin`. If you're running Windows, it's preferrable that you use `cmd.exe`, as `Cygwin` is [not official supported by Node.js](https://github.com/chjj/blessed/issues/56#issuecomment-42671945).

### I get `Invalid MBR boot signature` when configuring a device

This error, accompanied with something like: `Expected 0xAA55, but saw 0x29FE` usually indicates a corrupted device operating system image in the cache, due to bad a internet connection during the download process.

Try clearing the cache with the following command and trying again:

```sh
$ rm -rf $HOME/.resin/cache
```

Or in Windows:

```sh
> del /s /q %UserProfile%\_resin\cache
```

### I get `EACCES: permission denied` when logging in

The Resin CLI stores the session token in `$HOME/.resin` or `C:\Users\<user>\_resin` in UNIX based operating systems and Windows respectively. This error usually indicates that the user doesn't have permissions over that directory, which can happen if you ran the Resin CLI as `root`, and thus the directory got owned by him.

Try resetting the ownership by running:

```sh
$ sudo chown -R <user> $HOME/.resin
```
