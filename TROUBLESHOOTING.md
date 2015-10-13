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
